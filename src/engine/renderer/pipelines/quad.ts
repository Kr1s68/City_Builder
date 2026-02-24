/**
 * Factory for the solid building quad render pipeline.
 *
 * Key characteristics:
 *   - Topology: "triangle-list" — every 3 vertices form one triangle.
 *     Each quad is 2 triangles (6 vertices). See quads.ts for layout.
 *   - No blending — the fragment colour completely replaces what is behind.
 *   - Buffer is pre-allocated for MAX_QUADS and overwritten each frame.
 */

import type { GPUContext } from "../types";
import type { QuadPipeline } from "./types";
import { MAX_QUAD_BUFFER_SIZE } from "./constants";
import { QUAD_SHADER } from "../shaders";

/**
 * Creates the pipeline for solid, opaque building quads (placed entities).
 *
 * @param ctx Shared GPU resources (device, format, layouts).
 * @returns   A QuadPipeline with the compiled pipeline and vertex buffer.
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
