/**
 * Factory for the background grid render pipeline.
 *
 * Key characteristics:
 *   - Topology: "line-list" — every pair of vertices draws one line segment.
 *   - Vertex buffer is filled once (from gridLineData) and never updated.
 *   - No alpha blending — grid lines are fully opaque.
 */

import type { GPUContext } from "../types";
import type { GridPipeline } from "./types";
import { GRID_SHADER } from "../shaders";

/**
 * Creates the render pipeline used to draw the background grid.
 *
 * @param ctx          Shared GPU resources (device, format, layouts).
 * @param gridLineData Pre-computed flat array of (x,y) endpoint pairs for every grid line.
 * @returns            A GridPipeline with the compiled pipeline, vertex buffer, and vertex count.
 */
export function createGridPipeline(
  ctx: GPUContext,
  gridLineData: Float32Array,
): GridPipeline {
  const module = ctx.device.createShaderModule({ code: GRID_SHADER });

  // Each vertex is 2 floats (x,y), so total vertices = total floats / 2.
  const vertexCount = gridLineData.length / 2;

  // Allocate a GPU buffer exactly the size of the line data.
  // VERTEX = GPU reads it as vertex data; COPY_DST = CPU can write via writeBuffer.
  const vertexBuffer = ctx.device.createBuffer({
    size: gridLineData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  // Upload the grid geometry to the GPU. This is a one-time write.
  ctx.device.queue.writeBuffer(vertexBuffer, 0, gridLineData as Float32Array<ArrayBuffer>);

  const pipeline = ctx.device.createRenderPipeline({
    layout: ctx.pipelineLayout,
    vertex: { module, entryPoint: "vs", buffers: [ctx.vertexBufferLayout] },
    fragment: { module, entryPoint: "fs", targets: [{ format: ctx.format }] },
    // "line-list": vertices are consumed in pairs, each pair = one line segment.
    primitive: { topology: "line-list" },
  });

  return { pipeline, vertexBuffer, vertexCount };
}
