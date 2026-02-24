/**
 * Factories for texture-mapped render pipelines.
 *
 * Unlike the flat-colour pipelines, textured pipelines:
 *   - Use a vertex layout with 4 floats per vertex (x, y, u, v).
 *   - Have a second bind group (@group(1)) containing a sampler + texture.
 *   - Enable alpha blending so textures with transparency composite correctly.
 *   - Create their own pipeline layout (two bind groups) rather than sharing
 *     the flat-colour single-group layout.
 *
 * Two variants:
 *   - createTexturedPipeline:        Full-opacity textured buildings.
 *   - createTexturedPreviewPipeline: Ghost preview at 40% opacity.
 */

import type { GPUContext } from "../types";
import type { TexturedPipeline } from "./types";
import { MAX_QUAD_BUFFER_SIZE_TEXTURED } from "./constants";
import { ALPHA_BLEND } from "./blend";
import { TEXTURED_SHADER, TEXTURED_PREVIEW_SHADER } from "../shaders";

/**
 * Vertex layout for textured quads: (x, y, u, v) — 4 floats x 4 bytes = 16 bytes per vertex.
 */
function createTexturedVertexLayout(): GPUVertexBufferLayout {
  return {
    arrayStride: 4 * 4,
    attributes: [
      { shaderLocation: 0, offset: 0, format: "float32x2" as GPUVertexFormat },  // pos
      { shaderLocation: 1, offset: 8, format: "float32x2" as GPUVertexFormat },  // uv
    ],
  };
}

/**
 * Creates bind group layouts and pipeline layout for the two-group textured setup.
 *
 * @returns The texture bind group layout, uniform bind group layout, and combined pipeline layout.
 */
function createTexturedLayouts(device: GPUDevice) {
  const textureBindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
    ],
  });

  // Uniform bind group layout for group(0) — same shape as the shared one but
  // must be a separate object because it belongs to a different pipeline layout.
  const uniformBindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [uniformBindGroupLayout, textureBindGroupLayout],
  });

  return { textureBindGroupLayout, uniformBindGroupLayout, pipelineLayout };
}

/**
 * Creates a nearest-neighbour sampler and a bind group pairing it with a texture.
 */
function createTextureBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  texture: GPUTexture,
): GPUBindGroup {
  const sampler = device.createSampler({
    magFilter: "nearest",
    minFilter: "nearest",
  });

  return device.createBindGroup({
    layout,
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: texture.createView() },
    ],
  });
}

/**
 * Creates a pipeline for rendering textured quads (full opacity).
 *
 * @param ctx     Shared GPU resources.
 * @param texture The GPUTexture to sample from.
 */
export function createTexturedPipeline(
  ctx: GPUContext,
  texture: GPUTexture,
): TexturedPipeline {
  const module = ctx.device.createShaderModule({ code: TEXTURED_SHADER });
  const vertexLayout = createTexturedVertexLayout();
  const layouts = createTexturedLayouts(ctx.device);

  const textureBindGroup = createTextureBindGroup(ctx.device, layouts.textureBindGroupLayout, texture);

  const vertexBuffer = ctx.device.createBuffer({
    size: MAX_QUAD_BUFFER_SIZE_TEXTURED,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // Separate uniform bind group because the textured pipeline uses a different pipeline layout.
  const uniformBindGroup = ctx.device.createBindGroup({
    layout: layouts.uniformBindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: ctx.uniformBuffer } }],
  });

  const pipeline = ctx.device.createRenderPipeline({
    layout: layouts.pipelineLayout,
    vertex: { module, entryPoint: "vs", buffers: [vertexLayout] },
    fragment: {
      module,
      entryPoint: "fs",
      targets: [{ format: ctx.format, blend: ALPHA_BLEND }],
    },
    primitive: { topology: "triangle-list" },
  });

  return { pipeline, vertexBuffer, textureBindGroup, uniformBindGroup };
}

/**
 * Creates a pipeline for the textured placement preview (ghost).
 * Same layout as createTexturedPipeline but uses TEXTURED_PREVIEW_SHADER
 * which outputs at 40% opacity for the ghost effect.
 *
 * @param ctx     Shared GPU resources.
 * @param texture The GPUTexture to sample from.
 */
export function createTexturedPreviewPipeline(
  ctx: GPUContext,
  texture: GPUTexture,
): TexturedPipeline {
  const module = ctx.device.createShaderModule({ code: TEXTURED_PREVIEW_SHADER });
  const vertexLayout = createTexturedVertexLayout();
  const layouts = createTexturedLayouts(ctx.device);

  const textureBindGroup = createTextureBindGroup(ctx.device, layouts.textureBindGroupLayout, texture);

  const vertexBuffer = ctx.device.createBuffer({
    size: MAX_QUAD_BUFFER_SIZE_TEXTURED,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const uniformBindGroup = ctx.device.createBindGroup({
    layout: layouts.uniformBindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: ctx.uniformBuffer } }],
  });

  const pipeline = ctx.device.createRenderPipeline({
    layout: layouts.pipelineLayout,
    vertex: { module, entryPoint: "vs", buffers: [vertexLayout] },
    fragment: {
      module,
      entryPoint: "fs",
      targets: [{ format: ctx.format, blend: ALPHA_BLEND }],
    },
    primitive: { topology: "triangle-list" },
  });

  return { pipeline, vertexBuffer, textureBindGroup, uniformBindGroup };
}
