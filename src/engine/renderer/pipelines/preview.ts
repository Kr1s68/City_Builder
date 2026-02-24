/**
 * Factory for the placement preview ("ghost") render pipeline.
 *
 * Key characteristics:
 *   - Identical to the quad pipeline except:
 *     - Uses PREVIEW_SHADER (30% opacity green).
 *     - Enables standard "src-over" alpha blending so the semi-transparent
 *       green mixes with the framebuffer contents underneath.
 */

import type { GPUContext } from "../types";
import type { QuadPipeline } from "./types";
import { MAX_QUAD_BUFFER_SIZE } from "./constants";
import { ALPHA_BLEND } from "./blend";
import { PREVIEW_SHADER } from "../shaders";

/**
 * Creates the pipeline for the semi-transparent placement preview (ghost quads).
 *
 * @param ctx Shared GPU resources (device, format, layouts).
 * @returns   A QuadPipeline with the compiled pipeline and vertex buffer.
 */
export function createPreviewPipeline(ctx: GPUContext): QuadPipeline {
  const module = ctx.device.createShaderModule({ code: PREVIEW_SHADER });

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
