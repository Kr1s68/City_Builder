/** Pipeline creation helpers. */

import type { GPUContext } from "./types";
import { GRID_SHADER, QUAD_SHADER, PREVIEW_SHADER, MOVEABLE_SHADER } from "./shaders";

export interface GridPipeline {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  vertexCount: number;
}

export function createGridPipeline(
  ctx: GPUContext,
  gridLineData: Float32Array,
): GridPipeline {
  const module = ctx.device.createShaderModule({ code: GRID_SHADER });
  const vertexCount = gridLineData.length / 2;

  const vertexBuffer = ctx.device.createBuffer({
    size: gridLineData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  ctx.device.queue.writeBuffer(vertexBuffer, 0, gridLineData as Float32Array<ArrayBuffer>);

  const pipeline = ctx.device.createRenderPipeline({
    layout: ctx.pipelineLayout,
    vertex: { module, entryPoint: "vs", buffers: [ctx.vertexBufferLayout] },
    fragment: { module, entryPoint: "fs", targets: [{ format: ctx.format }] },
    primitive: { topology: "line-list" },
  });

  return { pipeline, vertexBuffer, vertexCount };
}

export interface QuadPipeline {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
}

export function createQuadPipeline(ctx: GPUContext): QuadPipeline {
  const module = ctx.device.createShaderModule({ code: QUAD_SHADER });

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

export function createPreviewPipeline(ctx: GPUContext): QuadPipeline {
  const module = ctx.device.createShaderModule({ code: PREVIEW_SHADER });

  const vertexBuffer = ctx.device.createBuffer({
    size: MAX_QUAD_BUFFER_SIZE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const alphaBlend: GPUBlendState = {
    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
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

export function createMoveablePipeline(ctx: GPUContext): QuadPipeline {
  const module = ctx.device.createShaderModule({ code: MOVEABLE_SHADER });

  const vertexBuffer = ctx.device.createBuffer({
    size: MAX_QUAD_BUFFER_SIZE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const alphaBlend: GPUBlendState = {
    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
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

/** Max quads per draw × 12 floats × 4 bytes. */
const MAX_QUAD_BUFFER_SIZE = 4096 * 12 * 4;
