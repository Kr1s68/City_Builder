/**
 * Factory for the road / path cell render pipeline.
 *
 * Key characteristics:
 *   - Same structure as the quad pipeline — solid opaque quads, no blending.
 *   - Uses PATH_SHADER (gray colour) to distinguish roads from buildings.
 *   - Drawn before buildings in the render pass so building quads cover
 *     any overlapping path cells underneath.
 */

import type { GPUContext } from "../types";
import type { QuadPipeline } from "./types";
import { MAX_QUAD_BUFFER_SIZE } from "./constants";
import { PATH_SHADER } from "../shaders";

/**
 * Creates the pipeline for path cells connecting buildings.
 *
 * @param ctx Shared GPU resources (device, format, layouts).
 * @returns   A QuadPipeline with the compiled pipeline and vertex buffer.
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
