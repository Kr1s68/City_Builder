/**
 * Factory for the moveable entity highlight render pipeline.
 *
 * Key characteristics:
 *   - Structurally identical to the preview pipeline — same alpha blending,
 *     same buffer sizing.
 *   - Uses MOVEABLE_SHADER (55% opacity red) to communicate
 *     "this entity is selected for repositioning".
 */

import type { GPUContext } from "../types";
import type { QuadPipeline } from "./types";
import { MAX_QUAD_BUFFER_SIZE } from "./constants";
import { ALPHA_BLEND } from "./blend";
import { MOVEABLE_SHADER } from "../shaders";

/**
 * Creates the pipeline for moveable entity highlights (semi-transparent red quads).
 *
 * @param ctx Shared GPU resources (device, format, layouts).
 * @returns   A QuadPipeline with the compiled pipeline and vertex buffer.
 */
export function createMoveablePipeline(ctx: GPUContext): QuadPipeline {
  const module = ctx.device.createShaderModule({ code: MOVEABLE_SHADER });

  const vertexBuffer = ctx.device.createBuffer({
    size: MAX_QUAD_BUFFER_SIZE,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const pipeline = ctx.device.createRenderPipeline({
    layout: ctx.pipelineLayout,
    vertex: { module, entryPoint: "vs", buffers: [ctx.vertexBufferLayout] },
    fragment: {
      module,
      entryPoint: "fs",
      targets: [{ format: ctx.format, blend: ALPHA_BLEND }],
    },
    primitive: { topology: "triangle-list" },
  });

  return { pipeline, vertexBuffer };
}
