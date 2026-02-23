/** Pipeline creation helpers. */

import type { GPUContext } from "./types";
import { GRID_SHADER, QUAD_SHADER, PREVIEW_SHADER, MOVEABLE_SHADER, PATH_SHADER, TEXTURED_SHADER, TEXTURED_PREVIEW_SHADER } from "./shaders";

/**
 * HOW RENDER PIPELINES WORK
 * --------------------------
 * A GPURenderPipeline is a compiled, immutable description of a full draw operation:
 *   - Which shader code runs (vertex + fragment stages)
 *   - How vertices are read from a buffer (layout)
 *   - What primitive shape is assembled from those vertices (topology)
 *   - How the output colour is blended with what is already in the framebuffer
 *
 * Pipelines are expensive to create (shader compilation happens here) so we create
 * them once at startup and reuse them every frame.
 *
 * There are two pipeline "shapes" used in this renderer:
 *   GridPipeline   — pre-baked vertex buffer (grid lines never change)
 *   QuadPipeline   — dynamic vertex buffer refilled each frame with cell geometry
 */

// ---------------------------------------------------------------------------
// Grid pipeline
// ---------------------------------------------------------------------------

/** Return type for the grid pipeline — includes vertexCount so the caller knows how many vertices to draw. */
export interface GridPipeline {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  /** Number of vertices in the buffer (pre-computed from gridLineData.length / 2). */
  vertexCount: number;
}

/**
 * Creates the render pipeline used to draw the background grid.
 *
 * Key differences from quad pipelines:
 *  - Topology is "line-list": every pair of vertices draws one line segment.
 *  - The vertex buffer is filled once (from `gridLineData`) and never updated again —
 *    the grid doesn't change at runtime.
 *  - No alpha blending: grid lines are fully opaque.
 *
 * @param ctx          Shared GPU resources.
 * @param gridLineData Pre-computed flat array of (x,y) endpoint pairs for every grid line.
 */
export function createGridPipeline(
  ctx: GPUContext,
  gridLineData: Float32Array,
): GridPipeline {
  // Compile the WGSL source into a GPU shader module.
  const module = ctx.device.createShaderModule({ code: GRID_SHADER });

  // Each vertex is 2 floats (x,y), so total vertices = total floats / 2.
  const vertexCount = gridLineData.length / 2;

  // Allocate a GPU buffer exactly the size of the line data.
  // VERTEX means the GPU will read it as vertex data.
  // COPY_DST means we can write to it from the CPU (via writeBuffer).
  const vertexBuffer = ctx.device.createBuffer({
    size: gridLineData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // Upload the grid geometry to the GPU. This is a one-time write.
  ctx.device.queue.writeBuffer(vertexBuffer, 0, gridLineData as Float32Array<ArrayBuffer>);

  const pipeline = ctx.device.createRenderPipeline({
    layout: ctx.pipelineLayout,                                  // bind group layout (uniform buffer)
    vertex: { module, entryPoint: "vs", buffers: [ctx.vertexBufferLayout] },
    fragment: { module, entryPoint: "fs", targets: [{ format: ctx.format }] },
    // "line-list": vertices are consumed in pairs, each pair = one line segment.
    primitive: { topology: "line-list" },
  });

  return { pipeline, vertexBuffer, vertexCount };
}

// ---------------------------------------------------------------------------
// Quad pipeline (shared shape for all cell-based layers)
// ---------------------------------------------------------------------------

/** Return type for quad pipelines — no vertexCount because it changes every frame. */
export interface QuadPipeline {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
}

/**
 * Creates the pipeline for solid, opaque building quads (placed entities).
 *
 *  - Topology "triangle-list": vertices are consumed in triples, each triple = one triangle.
 *    Two triangles make one quad (see quads.ts for the layout).
 *  - No blending: the fragment colour completely replaces whatever was behind it.
 *  - Buffer is pre-allocated for MAX_QUADS quads and overwritten each frame.
 */
export function createQuadPipeline(ctx: GPUContext): QuadPipeline {
  const module = ctx.device.createShaderModule({ code: QUAD_SHADER });

  // Allocate the maximum-size vertex buffer upfront so we never reallocate mid-game.
  const vertexBuffer = ctx.device.createBuffer({
    size: MAX_QUAD_BUFFER_SIZE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const pipeline = ctx.device.createRenderPipeline({
    layout: ctx.pipelineLayout,
    vertex: { module, entryPoint: "vs", buffers: [ctx.vertexBufferLayout] },
    fragment: { module, entryPoint: "fs", targets: [{ format: ctx.format }] },
    primitive: { topology: "triangle-list" },
  });

  return { pipeline, vertexBuffer };
}

/**
 * Creates the pipeline for the semi-transparent placement preview (ghost quads).
 *
 * Identical to createQuadPipeline() except:
 *  - Uses PREVIEW_SHADER, which outputs rgba(0.2, 0.8, 0.3, 0.3) — 30 % opacity.
 *  - Enables standard "over" alpha blending on the colour target so the partially
 *    transparent green mixes with whatever is already in the framebuffer.
 *
 * Alpha blend formula (per channel):
 *   out.rgb = src.rgb * src.a  +  dst.rgb * (1 − src.a)
 *   out.a   = src.a  * 1      +  dst.a   * (1 − src.a)
 */
export function createPreviewPipeline(ctx: GPUContext): QuadPipeline {
  const module = ctx.device.createShaderModule({ code: PREVIEW_SHADER });

  const vertexBuffer = ctx.device.createBuffer({
    size: MAX_QUAD_BUFFER_SIZE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // Standard "src-over" / "porter-duff over" blending.
  const alphaBlend: GPUBlendState = {
    color: {
      srcFactor: "src-alpha",           // weight new pixel by its own alpha
      dstFactor: "one-minus-src-alpha", // weight existing pixel by (1 - new alpha)
      operation: "add",
    },
    alpha: {
      srcFactor: "one",                 // keep the full source alpha
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    },
  };

  const pipeline = ctx.device.createRenderPipeline({
    layout: ctx.pipelineLayout,
    vertex: { module, entryPoint: "vs", buffers: [ctx.vertexBufferLayout] },
    fragment: {
      module,
      entryPoint: "fs",
      targets: [{ format: ctx.format, blend: alphaBlend }], // blending enabled here
    },
    primitive: { topology: "triangle-list" },
  });

  return { pipeline, vertexBuffer };
}

/**
 * Creates the pipeline for path cells connecting buildings.
 *
 * Same structure as createQuadPipeline() — solid opaque quads, no blending.
 * Drawn before buildings so building quads cover any overlapping path cells.
 */
export function createPathPipeline(ctx: GPUContext): QuadPipeline {
  const module = ctx.device.createShaderModule({ code: PATH_SHADER });

  const vertexBuffer = ctx.device.createBuffer({
    size: MAX_QUAD_BUFFER_SIZE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const pipeline = ctx.device.createRenderPipeline({
    layout: ctx.pipelineLayout,
    vertex: { module, entryPoint: "vs", buffers: [ctx.vertexBufferLayout] },
    fragment: { module, entryPoint: "fs", targets: [{ format: ctx.format }] },
    primitive: { topology: "triangle-list" },
  });

  return { pipeline, vertexBuffer };
}

/**
 * Creates the pipeline for moveable entity highlights (semi-transparent red quads).
 *
 * Structurally identical to createPreviewPipeline() — same alpha blending,
 * same buffer sizing — only the shader (and therefore the colour) differs.
 * The red tint communicates "this entity is selected for repositioning".
 */
export function createMoveablePipeline(ctx: GPUContext): QuadPipeline {
  const module = ctx.device.createShaderModule({ code: MOVEABLE_SHADER });

  const vertexBuffer = ctx.device.createBuffer({
    size: MAX_QUAD_BUFFER_SIZE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // Same blend state as the preview pipeline.
  const alphaBlend: GPUBlendState = {
    color: {
      srcFactor: "src-alpha",
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    },
    alpha: {
      srcFactor: "one",
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    },
  };

  const pipeline = ctx.device.createRenderPipeline({
    layout: ctx.pipelineLayout,
    vertex: { module, entryPoint: "vs", buffers: [ctx.vertexBufferLayout] },
    fragment: {
      module,
      entryPoint: "fs",
      targets: [{ format: ctx.format, blend: alphaBlend }],
    },
    primitive: { topology: "triangle-list" },
  });

  return { pipeline, vertexBuffer };
}

// ---------------------------------------------------------------------------
// Textured pipeline
// ---------------------------------------------------------------------------

/** Return type for the textured pipeline — includes both bind groups. */
export interface TexturedPipeline {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  /** Bind group for the uniform buffer (group 0) — separate from the shared one because of a different layout. */
  uniformBindGroup: GPUBindGroup;
  /** Bind group for the sampler + texture (group 1). */
  textureBindGroup: GPUBindGroup;
}

/**
 * Creates a pipeline for rendering textured quads.
 *
 * Unlike the flat-colour pipelines, this one:
 *  - Uses a vertex layout with 4 floats per vertex (x, y, u, v).
 *  - Has a second bind group (@group(1)) containing a sampler + texture.
 *  - Enables alpha blending so textures with transparency composite correctly.
 *
 * @param ctx     Shared GPU resources.
 * @param texture The GPUTexture to sample from.
 */
export function createTexturedPipeline(
  ctx: GPUContext,
  texture: GPUTexture,
): TexturedPipeline {
  const module = ctx.device.createShaderModule({ code: TEXTURED_SHADER });

  // Vertex layout: (x, y, u, v) — 4 floats × 4 bytes = 16 bytes per vertex.
  const texturedVertexLayout: GPUVertexBufferLayout = {
    arrayStride: 4 * 4,
    attributes: [
      { shaderLocation: 0, offset: 0, format: "float32x2" as GPUVertexFormat },  // pos
      { shaderLocation: 1, offset: 8, format: "float32x2" as GPUVertexFormat },  // uv
    ],
  };

  // Second bind group layout for the texture + sampler.
  const textureBindGroupLayout = ctx.device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
    ],
  });

  // Uniform bind group layout for group(0) — same shape as the shared one but
  // must be a separate object because it belongs to a different pipeline layout.
  const texUniformBindGroupLayout = ctx.device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
    ],
  });

  // Pipeline layout: group(0) = uniforms, group(1) = texture.
  const texPipelineLayout = ctx.device.createPipelineLayout({
    bindGroupLayouts: [texUniformBindGroupLayout, textureBindGroupLayout],
  });

  const sampler = ctx.device.createSampler({
    magFilter: "nearest",
    minFilter: "nearest",
  });

  const textureBindGroup = ctx.device.createBindGroup({
    layout: textureBindGroupLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: texture.createView() },
    ],
  });

  // Alpha blending so texture transparency works.
  const alphaBlend: GPUBlendState = {
    color: {
      srcFactor: "src-alpha",
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    },
    alpha: {
      srcFactor: "one",
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    },
  };

  const vertexBuffer = ctx.device.createBuffer({
    size: MAX_QUAD_BUFFER_SIZE_TEXTURED,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // We need a separate uniform bind group for the textured pipeline because
  // it uses a different pipeline layout.
  const texUniformBindGroup = ctx.device.createBindGroup({
    layout: texUniformBindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: ctx.uniformBuffer } }],
  });

  const pipeline = ctx.device.createRenderPipeline({
    layout: texPipelineLayout,
    vertex: { module, entryPoint: "vs", buffers: [texturedVertexLayout] },
    fragment: {
      module,
      entryPoint: "fs",
      targets: [{ format: ctx.format, blend: alphaBlend }],
    },
    primitive: { topology: "triangle-list" },
  });

  return { pipeline, vertexBuffer, textureBindGroup, uniformBindGroup: texUniformBindGroup };
}

/**
 * Creates a pipeline for the textured placement preview (ghost).
 * Same layout as createTexturedPipeline but uses TEXTURED_PREVIEW_SHADER
 * which outputs at 40% opacity for the ghost effect.
 * Reuses the texture bind group from an existing textured pipeline.
 */
export function createTexturedPreviewPipeline(
  ctx: GPUContext,
  texture: GPUTexture,
): TexturedPipeline {
  const module = ctx.device.createShaderModule({ code: TEXTURED_PREVIEW_SHADER });

  const texturedVertexLayout: GPUVertexBufferLayout = {
    arrayStride: 4 * 4,
    attributes: [
      { shaderLocation: 0, offset: 0, format: "float32x2" as GPUVertexFormat },
      { shaderLocation: 1, offset: 8, format: "float32x2" as GPUVertexFormat },
    ],
  };

  const textureBindGroupLayout = ctx.device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
    ],
  });

  const texUniformBindGroupLayout = ctx.device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
    ],
  });

  const texPipelineLayout = ctx.device.createPipelineLayout({
    bindGroupLayouts: [texUniformBindGroupLayout, textureBindGroupLayout],
  });

  const sampler = ctx.device.createSampler({ magFilter: "nearest", minFilter: "nearest" });

  const textureBindGroup = ctx.device.createBindGroup({
    layout: textureBindGroupLayout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: texture.createView() },
    ],
  });

  const alphaBlend: GPUBlendState = {
    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
  };

  const vertexBuffer = ctx.device.createBuffer({
    size: MAX_QUAD_BUFFER_SIZE_TEXTURED,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const texUniformBindGroup = ctx.device.createBindGroup({
    layout: texUniformBindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: ctx.uniformBuffer } }],
  });

  const pipeline = ctx.device.createRenderPipeline({
    layout: texPipelineLayout,
    vertex: { module, entryPoint: "vs", buffers: [texturedVertexLayout] },
    fragment: {
      module, entryPoint: "fs",
      targets: [{ format: ctx.format, blend: alphaBlend }],
    },
    primitive: { topology: "triangle-list" },
  });

  return { pipeline, vertexBuffer, textureBindGroup, uniformBindGroup: texUniformBindGroup };
}

/**
 * Pre-computed size in bytes for a quad vertex buffer at maximum capacity.
 * 4096 quads × 12 floats/quad × 4 bytes/float = 196 608 bytes (~192 KB).
 * Allocated once; only the used portion is uploaded each frame.
 */
const MAX_QUAD_BUFFER_SIZE = 4096 * 12 * 4;

/**
 * Pre-computed size for textured quad vertex buffer.
 * 4096 quads × 24 floats/quad × 4 bytes/float = 393 216 bytes (~384 KB).
 * Textured quads have 4 floats per vertex (x, y, u, v) instead of 2.
 */
const MAX_QUAD_BUFFER_SIZE_TEXTURED = 4096 * 24 * 4;
