/** Quad geometry helpers — builds triangle-list vertex data from cell coordinates. */

import { CELL_SIZE } from "../../game/grid";
import type { OccupiedCell, TexturedEntity } from "./types";
import type { UVRegion } from "../assets";

/** Maximum cells we can render in a single draw call. Raising this increases VRAM usage. */
export const MAX_QUADS = 4096;

/**
 * Number of floats needed to describe one quad (rectangle).
 *
 * A quad is split into 2 triangles so the GPU can rasterise it (GPUs only draw triangles):
 *
 *   (x0,y1)──(x1,y1)
 *      │  ╲      │
 *      │    ╲    │
 *      │      ╲  │
 *   (x0,y0)──(x1,y0)
 *
 * Triangle 1: top-left  → (x0,y0), (x1,y0), (x0,y1)
 * Triangle 2: bottom-right → (x1,y0), (x1,y1), (x0,y1)
 *
 * That's 2 triangles × 3 vertices × 2 floats (x,y) = 12 floats per quad.
 */
export const FLOATS_PER_QUAD = 12;

/**
 * Converts a list of grid cells into GPU-ready triangle vertex data.
 *
 * Steps:
 *  1. For each cell, compute the four corner world-space positions using CELL_SIZE.
 *  2. Write two triangles (6 vertices × 2 floats) into `cpuBuf` at the correct offset.
 *  3. Upload the relevant slice of `cpuBuf` to the GPU vertex buffer `gpuBuf`.
 *
 * The same CPU buffer is reused every frame (passed in from the caller)
 * to avoid heap allocation in the hot path.
 *
 * @param device  WebGPU device — needed to schedule the buffer upload.
 * @param cells   Array of grid cells to render (capped at MAX_QUADS).
 * @param cpuBuf  Pre-allocated Float32Array large enough for MAX_QUADS * FLOATS_PER_QUAD floats.
 * @param gpuBuf  The GPU vertex buffer that this draw call will read from.
 * @returns The number of quads written (pass this to `draw(count * 6)`).
 */
export function buildQuads(
  device: GPUDevice,
  cells: OccupiedCell[],
  cpuBuf: Float32Array,
  gpuBuf: GPUBuffer,
): number {
  // Never write more quads than the buffer was sized for.
  const count = Math.min(cells.length, MAX_QUADS);

  for (let i = 0; i < count; i++) {
    const c = cells[i];

    // Convert grid column/row to world-space pixel coordinates.
    // x0/y0 = top-left corner of the cell, x1/y1 = bottom-right corner.
    const x0 = c.col * CELL_SIZE;
    const y0 = c.row * CELL_SIZE;
    const x1 = x0 + CELL_SIZE;
    const y1 = y0 + CELL_SIZE;

    // Byte offset into the flat array for this quad's 12 floats.
    const off = i * FLOATS_PER_QUAD;

    // Triangle 1 — covers the top-left half of the quad
    //   Vertex A: top-left     (x0, y0)
    cpuBuf[off + 0] = x0; cpuBuf[off + 1] = y0;
    //   Vertex B: top-right    (x1, y0)
    cpuBuf[off + 2] = x1; cpuBuf[off + 3] = y0;
    //   Vertex C: bottom-left  (x0, y1)
    cpuBuf[off + 4] = x0; cpuBuf[off + 5] = y1;

    // Triangle 2 — covers the bottom-right half of the quad
    //   Vertex D: top-right    (x1, y0)
    cpuBuf[off + 6] = x1; cpuBuf[off + 7] = y0;
    //   Vertex E: bottom-right (x1, y1)
    cpuBuf[off + 8] = x1; cpuBuf[off + 9] = y1;
    //   Vertex F: bottom-left  (x0, y1)
    cpuBuf[off + 10] = x0; cpuBuf[off + 11] = y1;
  }

  if (count > 0) {
    // Upload only the floats we actually wrote — uploading the whole buffer
    // when count is small would waste GPU bandwidth.
    device.queue.writeBuffer(
      gpuBuf,
      0,                          // destination offset in bytes
      cpuBuf as Float32Array<ArrayBuffer>,
      0,                          // source element offset
      count * FLOATS_PER_QUAD,    // number of floats to copy
    );
  }

  return count;
}

/**
 * Number of floats per textured quad.
 * Each vertex has 4 floats (x, y, u, v) instead of 2.
 * 2 triangles × 3 vertices × 4 floats = 24 floats per quad.
 */
export const FLOATS_PER_TEXTURED_QUAD = 24;

/**
 * Converts a list of textured entities into GPU-ready triangle vertex data
 * with UV coordinates. Each entity becomes a single quad spanning its full
 * width × height in grid cells.
 *
 * @param device   WebGPU device — needed to schedule the buffer upload.
 * @param entities Array of entities with col, row, width, height, type.
 * @param cpuBuf   Pre-allocated Float32Array for MAX_QUADS * FLOATS_PER_TEXTURED_QUAD floats.
 * @param gpuBuf   The GPU vertex buffer that this draw call will read from.
 * @param uvMap    Per-building-type UV regions within the atlas texture.
 * @returns The number of quads written (pass this to `draw(count * 6)`).
 */
export function buildTexturedQuads(
  device: GPUDevice,
  entities: TexturedEntity[],
  cpuBuf: Float32Array,
  gpuBuf: GPUBuffer,
  uvMap?: ReadonlyMap<string, UVRegion>,
): number {
  const count = Math.min(entities.length, MAX_QUADS);

  // Padding (in cells) to extend the quad beyond the entity footprint.
  // The building sprite is taller than its base, so we extend upward
  // (+y direction) to create a 3D height effect. Base stays anchored.
  const PAD_X = 0.25 * CELL_SIZE;   // extend left & right
  const PAD_UP = 1.0 * CELL_SIZE;   // extend upward (above footprint)

  // Default full-texture UV region (used when no atlas).
  const FULL_UV: UVRegion = { u0: 0, v0: 0, u1: 1, v1: 1 };

  for (let i = 0; i < count; i++) {
    const e = entities[i];

    const x0 = e.col * CELL_SIZE - PAD_X;
    const y0 = e.row * CELL_SIZE;                          // bottom stays flush
    const x1 = (e.col + e.width) * CELL_SIZE + PAD_X;
    const y1 = (e.row + e.height) * CELL_SIZE + PAD_UP;    // extend upward

    const off = i * FLOATS_PER_TEXTURED_QUAD;

    // Look up UV region for this entity's type, or fall back to full texture.
    const uv = (uvMap && uvMap.get(e.type)) ?? FULL_UV;

    // UVs are flipped vertically: top of quad = v1 (bottom of sprite),
    // bottom = v0 (top of sprite).
    // Triangle 1: top-left half
    cpuBuf[off +  0] = x0; cpuBuf[off +  1] = y0; cpuBuf[off +  2] = uv.u0; cpuBuf[off +  3] = uv.v1;
    cpuBuf[off +  4] = x1; cpuBuf[off +  5] = y0; cpuBuf[off +  6] = uv.u1; cpuBuf[off +  7] = uv.v1;
    cpuBuf[off +  8] = x0; cpuBuf[off +  9] = y1; cpuBuf[off + 10] = uv.u0; cpuBuf[off + 11] = uv.v0;

    // Triangle 2: bottom-right half
    cpuBuf[off + 12] = x1; cpuBuf[off + 13] = y0; cpuBuf[off + 14] = uv.u1; cpuBuf[off + 15] = uv.v1;
    cpuBuf[off + 16] = x1; cpuBuf[off + 17] = y1; cpuBuf[off + 18] = uv.u1; cpuBuf[off + 19] = uv.v0;
    cpuBuf[off + 20] = x0; cpuBuf[off + 21] = y1; cpuBuf[off + 22] = uv.u0; cpuBuf[off + 23] = uv.v0;
  }

  if (count > 0) {
    device.queue.writeBuffer(
      gpuBuf,
      0,
      cpuBuf as Float32Array<ArrayBuffer>,
      0,
      count * FLOATS_PER_TEXTURED_QUAD,
    );
  }

  return count;
}
