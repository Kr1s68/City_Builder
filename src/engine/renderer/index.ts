/** Renderer entry — initialises WebGPU and orchestrates per-frame drawing. */

export type { Renderer, OccupiedCell } from "./types";

import type { Renderer, OccupiedCell } from "./types";
import {
  createGridPipeline,
  createQuadPipeline,
  createPreviewPipeline,
  createMoveablePipeline,
} from "./pipelines";
import { buildQuads, MAX_QUADS, FLOATS_PER_QUAD } from "./quads";

export async function initRenderer(
  canvas: HTMLCanvasElement,
  gridLineData: Float32Array,
): Promise<Renderer> {
  // --- Adapter & device ---------------------------------------------------
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No WebGPU adapter found.");
  const device = await adapter.requestDevice();

  // --- Surface ------------------------------------------------------------
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("Could not get WebGPU context.");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  // --- Resize helper ------------------------------------------------------
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }
  resize();
  window.addEventListener("resize", resize);

  // --- Shared GPU resources -----------------------------------------------
  const uniformBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  const vertexBufferLayout: GPUVertexBufferLayout = {
    arrayStride: 2 * 4,
    attributes: [
      { shaderLocation: 0, offset: 0, format: "float32x2" as GPUVertexFormat },
    ],
  };

  const ctx = {
    device,
    format,
    pipelineLayout,
    vertexBufferLayout,
    bindGroup,
    uniformBuffer,
  };

  // --- Pipelines ----------------------------------------------------------
  const grid = createGridPipeline(ctx, gridLineData);
  const quad = createQuadPipeline(ctx);
  const preview = createPreviewPipeline(ctx);
  const moveable = createMoveablePipeline(ctx);

  // --- CPU-side quad buffers (reused each frame) --------------------------
  const quadCpuData = new Float32Array(MAX_QUADS * FLOATS_PER_QUAD);
  const previewCpuData = new Float32Array(MAX_QUADS * FLOATS_PER_QUAD);
  const moveableCpuData = new Float32Array(MAX_QUADS * FLOATS_PER_QUAD);

  // --- Frame callback -----------------------------------------------------
  function frame(
    viewProj: Float32Array,
    occupiedCells: OccupiedCell[],
    previewCells?: OccupiedCell[],
    moveableCells?: OccupiedCell[],
  ) {
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      viewProj as Float32Array<ArrayBuffer>,
    );

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

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context!.getCurrentTexture().createView(),
          clearValue: { r: 0.22, g: 0.45, b: 0.15, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    // 1) Filled quads (placed entities)
    if (quadCount > 0) {
      pass.setPipeline(quad.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, quad.vertexBuffer);
      pass.draw(quadCount * 6);
    }

    // 2) Moveable entity quads (semi-transparent red)
    if (moveableCount > 0) {
      pass.setPipeline(moveable.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, moveable.vertexBuffer);
      pass.draw(moveableCount * 6);
    }

    // 3) Preview quads (transparent ghost)
    if (previewCount > 0) {
      pass.setPipeline(preview.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, preview.vertexBuffer);
      pass.draw(previewCount * 6);
    }

    // 4) Grid lines (when enabled)
    if (state.showGrid) {
      pass.setPipeline(grid.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, grid.vertexBuffer);
      pass.draw(grid.vertexCount);
    }

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  const state: Renderer = {
    device,
    context,
    format,
    canvas,
    showGrid: false,
    frame,
  };
  return state;
}
