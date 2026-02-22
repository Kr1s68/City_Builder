/** Renderer entry — initialises WebGPU and orchestrates per-frame drawing. */

export type { Renderer, OccupiedCell } from "./types";

import type { Renderer, OccupiedCell } from "./types";
import {
  createGridPipeline,
  createQuadPipeline,
  createPreviewPipeline,
  createMoveablePipeline,
  createPathPipeline,
} from "./pipelines";
import { buildQuads, MAX_QUADS, FLOATS_PER_QUAD } from "./quads";

/**
 * Initialises the WebGPU renderer and returns a Renderer handle.
 *
 * This is async because requesting a GPU adapter and device involves a round-trip
 * to the browser's GPU process. Everything else (buffer creation, pipeline compilation)
 * is synchronous once we have the device.
 *
 * @param canvas       The HTML canvas we will render into.
 * @param gridLineData Pre-built flat (x,y) vertex array for all grid lines.
 *                     Generated once by the grid module and never changes.
 */
export async function initRenderer(
  canvas: HTMLCanvasElement,
  gridLineData: Float32Array,
): Promise<Renderer> {

  // --- Adapter & device ---------------------------------------------------
  // The "adapter" is a description of the physical GPU (or software fallback).
  // Null means no WebGPU-capable hardware was found.
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No WebGPU adapter found.");

  // The "device" is our logical connection to the GPU — all resource creation
  // and command submission goes through this object.
  const device = await adapter.requestDevice();

  // --- Surface ------------------------------------------------------------
  // "context" is the WebGPU swap chain tied to the canvas.
  // Each frame we ask it for the current texture (the backbuffer) to draw into.
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("Could not get WebGPU context.");

  // getPreferredCanvasFormat() returns the texture format the browser's compositor
  // expects (typically "bgra8unorm" on desktop, "rgba8unorm" on mobile).
  // We must use this same format in every render pipeline.
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: "opaque", // canvas has no transparency with the page behind it
  });

  // --- Resize helper ------------------------------------------------------
  // The canvas's internal resolution (width/height in pixels) must match the
  // physical display pixels, accounting for high-DPI screens (Retina, etc.).
  // devicePixelRatio is e.g. 2.0 on a Retina display, meaning 1 CSS pixel = 2 real pixels.
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    // clientWidth/Height is the CSS layout size; multiply by dpr for the actual pixel count.
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }
  resize(); // run once immediately so we start at the right resolution
  window.addEventListener("resize", resize); // keep in sync when the window resizes

  // --- Shared GPU resources -----------------------------------------------

  // The uniform buffer holds the view-projection matrix (a 4×4 matrix = 16 floats × 4 bytes = 64 bytes).
  // It is written to every frame from the CPU and read by every vertex shader.
  // UNIFORM = readable as a uniform by shaders; COPY_DST = writable from CPU via writeBuffer.
  const uniformBuffer = device.createBuffer({
    size: 64,   // 4×4 float32 matrix
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // The bind group layout describes the shape of what the shader expects at each @binding slot.
  // Here: one binding (slot 0), only visible to the vertex stage, containing a uniform buffer.
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,                            // matches @binding(0) in all shaders
        visibility: GPUShaderStage.VERTEX,     // only the vertex shader reads this
        buffer: { type: "uniform" },
      },
    ],
  });

  // The bind group is the actual connection between the layout and the specific
  // GPU buffer object. Passing this to pass.setBindGroup() makes the shader's
  // @binding(0) point at our uniformBuffer.
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  // The pipeline layout wraps the bind group layout so pipelines can reference it.
  // All four pipelines share the same layout (they all just need the uniform matrix).
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  // Describes how to read one vertex out of a vertex buffer:
  //   arrayStride = 8 bytes → advance 8 bytes between vertices (2 floats × 4 bytes)
  //   one attribute at shaderLocation 0 → the (x,y) position, read as two float32s
  const vertexBufferLayout: GPUVertexBufferLayout = {
    arrayStride: 2 * 4, // 2 floats × 4 bytes = 8 bytes per vertex
    attributes: [
      { shaderLocation: 0, offset: 0, format: "float32x2" as GPUVertexFormat },
    ],
  };

  // Bundle the shared resources into one object so pipeline helpers don't need
  // individual parameters for each piece.
  const ctx = {
    device,
    format,
    pipelineLayout,
    vertexBufferLayout,
    bindGroup,
    uniformBuffer,
  };

  // --- Pipelines ----------------------------------------------------------
  // Each pipeline is compiled once here. The grid pipeline also uploads its
  // vertex data now (it never changes); quad pipelines get data each frame.
  const grid = createGridPipeline(ctx, gridLineData);
  const quad = createQuadPipeline(ctx);
  const preview = createPreviewPipeline(ctx);
  const moveable = createMoveablePipeline(ctx);
  const path = createPathPipeline(ctx);

  // --- CPU-side quad buffers (reused each frame) --------------------------
  // Pre-allocate the maximum-size typed arrays on the CPU heap once.
  // buildQuads() overwrites these in-place every frame to avoid GC pressure.
  const quadCpuData = new Float32Array(MAX_QUADS * FLOATS_PER_QUAD);
  const previewCpuData = new Float32Array(MAX_QUADS * FLOATS_PER_QUAD);
  const moveableCpuData = new Float32Array(MAX_QUADS * FLOATS_PER_QUAD);
  const pathCpuData = new Float32Array(MAX_QUADS * FLOATS_PER_QUAD);

  // --- Frame callback -----------------------------------------------------
  /**
   * Renders one frame. Called by the game loop (typically via requestAnimationFrame).
   *
   * Flow:
   *  1. Upload the new view-projection matrix to the GPU uniform buffer.
   *  2. Build vertex data for each cell layer and upload to the GPU vertex buffers.
   *  3. Record a render pass (clear → quads → moveables → previews → grid).
   *  4. Submit the recorded commands to the GPU queue.
   *
   * @param viewProj       Column-major 4×4 matrix: world space → clip space.
   * @param occupiedCells  Placed buildings — drawn as solid green quads.
   * @param previewCells   Optional. Ghost quads for the placement cursor.
   * @param moveableCells  Optional. Red highlight quads for the entity being moved.
   * @param pathCells      Optional. Gray quads forming the road network between buildings.
   */
  function frame(
    viewProj: Float32Array,
    occupiedCells: OccupiedCell[],
    previewCells?: OccupiedCell[],
    moveableCells?: OccupiedCell[],
    pathCells?: OccupiedCell[],
  ) {
    // 1. Push the updated camera matrix to the GPU so all shaders see the new view.
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      viewProj as Float32Array<ArrayBuffer>,
    );

    // 2. Convert each cell list to triangle vertices and upload them.
    //    buildQuads() returns the number of quads written (we need this to know
    //    how many vertices to draw: quads × 2 triangles × 3 verts = quads × 6).
    const quadCount = buildQuads(
      device,
      occupiedCells,
      quadCpuData,
      quad.vertexBuffer,
    );
    const previewCount = previewCells
      ? buildQuads(device, previewCells, previewCpuData, preview.vertexBuffer)
      : 0;
    const moveableCount = moveableCells
      ? buildQuads(
          device,
          moveableCells,
          moveableCpuData,
          moveable.vertexBuffer,
        )
      : 0;
    const pathCount = pathCells
      ? buildQuads(device, pathCells, pathCpuData, path.vertexBuffer)
      : 0;

    // 3. Record GPU commands into an encoder (nothing runs on the GPU yet).
    const encoder = device.createCommandEncoder();

    // Begin a render pass targeting the current swap-chain texture.
    // loadOp "clear" fills the canvas with the clearValue colour before any drawing.
    // storeOp "store" writes the result back to the texture (as opposed to discarding it).
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context!.getCurrentTexture().createView(), // the current backbuffer
          clearValue: { r: 0.22, g: 0.45, b: 0.15, a: 1.0 }, // dark grass-green background
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    // Draw layers in back-to-front order so blending produces the correct result.

    // Layer 1: Path cells — gray roads connecting buildings.
    //          Drawn first so building quads cover any paths underneath them.
    if (pathCount > 0) {
      pass.setPipeline(path.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, path.vertexBuffer);
      pass.draw(pathCount * 6);
    }

    // Layer 2: Placed buildings — solid green, fully opaque.
    //          Covers path cells underneath and provides base for transparent layers.
    if (quadCount > 0) {
      pass.setPipeline(quad.pipeline);
      pass.setBindGroup(0, bindGroup);        // attach the uniform buffer (camera matrix)
      pass.setVertexBuffer(0, quad.vertexBuffer);
      pass.draw(quadCount * 6);              // 6 vertices per quad (2 triangles × 3 verts)
    }

    // Layer 3: Moveable entity — semi-transparent red, blends over buildings.
    if (moveableCount > 0) {
      pass.setPipeline(moveable.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, moveable.vertexBuffer);
      pass.draw(moveableCount * 6);
    }

    // Layer 4: Placement preview (ghost) — semi-transparent green, blends over everything.
    if (previewCount > 0) {
      pass.setPipeline(preview.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, preview.vertexBuffer);
      pass.draw(previewCount * 6);
    }

    // Layer 5: Grid lines — drawn last so they appear on top of all cell layers.
    //          Visibility controlled by state.showGrid (toggled by the UI).
    if (state.showGrid) {
      pass.setPipeline(grid.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, grid.vertexBuffer);
      pass.draw(grid.vertexCount); // vertexCount is fixed (pre-computed from gridLineData)
    }

    pass.end();

    // 4. Submit the finished command buffer to the GPU.
    //    The GPU will execute these commands asynchronously; the browser presents
    //    the result at the next VSync.
    device.queue.submit([encoder.finish()]);
  }

  const state: Renderer = {
    device,
    context,
    format,
    canvas,
    showGrid: false, // grid hidden by default; set to true to show cell boundaries
    frame,
  };
  return state;
}
