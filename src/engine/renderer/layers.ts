/**
 * Render layer abstractions.
 *
 * A "layer" bundles a GPU pipeline with its CPU-side staging buffer and
 * encapsulates the repetitive build-upload-draw cycle. Two variants exist:
 *
 *   - FlatLayer:     Flat-colour quads that share the renderer's global bind group.
 *   - TexturedLayer: Texture-mapped quads with their own uniform + texture bind groups.
 *
 * During a frame, each layer is first updated (geometry built + uploaded),
 * then drawn in back-to-front order.
 */

import type { QuadPipeline, TexturedPipeline, GridPipeline } from "./pipelines/index";
import type { OccupiedCell, TexturedEntity } from "./types";
import { buildQuads, buildTexturedQuads, MAX_QUADS, FLOATS_PER_QUAD, FLOATS_PER_TEXTURED_QUAD } from "./quads";

// ---------------------------------------------------------------------------
// Flat-colour layer
// ---------------------------------------------------------------------------

/** A render layer for flat-colour quads (path, building, preview, moveable). */
export interface FlatLayer {
  kind: "flat";
  pipeline: QuadPipeline;
  cpuBuffer: Float32Array;
  /** Number of quads to draw this frame (set by update()). */
  quadCount: number;
}

/** Creates a FlatLayer wrapping an existing QuadPipeline. */
export function createFlatLayer(pipeline: QuadPipeline): FlatLayer {
  return {
    kind: "flat",
    pipeline,
    cpuBuffer: new Float32Array(MAX_QUADS * FLOATS_PER_QUAD),
    quadCount: 0,
  };
}

/** Builds quad geometry from cells and uploads to the GPU. Updates quadCount. */
export function updateFlatLayer(
  layer: FlatLayer,
  device: GPUDevice,
  cells: OccupiedCell[] | undefined,
): void {
  layer.quadCount = cells
    ? buildQuads(device, cells, layer.cpuBuffer, layer.pipeline.vertexBuffer)
    : 0;
}

/** Issues draw commands for a flat layer if it has geometry. */
export function drawFlatLayer(
  layer: FlatLayer,
  pass: GPURenderPassEncoder,
  bindGroup: GPUBindGroup,
): void {
  if (layer.quadCount <= 0) return;
  pass.setPipeline(layer.pipeline.pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.setVertexBuffer(0, layer.pipeline.vertexBuffer);
  pass.draw(layer.quadCount * 6);
}

// ---------------------------------------------------------------------------
// Textured layer
// ---------------------------------------------------------------------------

/** A render layer for texture-mapped quads (textured buildings, textured preview). */
export interface TexturedLayer {
  kind: "textured";
  pipeline: TexturedPipeline;
  cpuBuffer: Float32Array;
  /** Number of quads to draw this frame (set by update()). */
  quadCount: number;
}

/** Creates a TexturedLayer wrapping an existing TexturedPipeline. */
export function createTexturedLayer(pipeline: TexturedPipeline): TexturedLayer {
  return {
    kind: "textured",
    pipeline,
    cpuBuffer: new Float32Array(MAX_QUADS * FLOATS_PER_TEXTURED_QUAD),
    quadCount: 0,
  };
}

/** Builds textured quad geometry from entities and uploads to the GPU. Updates quadCount. */
export function updateTexturedLayer(
  layer: TexturedLayer,
  device: GPUDevice,
  entities: TexturedEntity[] | undefined,
): void {
  layer.quadCount = entities
    ? buildTexturedQuads(device, entities, layer.cpuBuffer, layer.pipeline.vertexBuffer)
    : 0;
}

/** Issues draw commands for a textured layer if it has geometry. */
export function drawTexturedLayer(
  layer: TexturedLayer,
  pass: GPURenderPassEncoder,
): void {
  if (layer.quadCount <= 0) return;
  pass.setPipeline(layer.pipeline.pipeline);
  pass.setBindGroup(0, layer.pipeline.uniformBindGroup);
  pass.setBindGroup(1, layer.pipeline.textureBindGroup);
  pass.setVertexBuffer(0, layer.pipeline.vertexBuffer);
  pass.draw(layer.quadCount * 6);
}

// ---------------------------------------------------------------------------
// Grid layer (special — fixed vertex count, conditional draw)
// ---------------------------------------------------------------------------

/** Issues draw commands for the grid overlay. */
export function drawGridLayer(
  grid: GridPipeline,
  pass: GPURenderPassEncoder,
  bindGroup: GPUBindGroup,
): void {
  pass.setPipeline(grid.pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.setVertexBuffer(0, grid.vertexBuffer);
  pass.draw(grid.vertexCount);
}
