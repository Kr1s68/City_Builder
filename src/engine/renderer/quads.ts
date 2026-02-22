/** Quad geometry helpers — builds triangle-list vertex data from cell coordinates. */

import { CELL_SIZE } from "../../game/grid";
import type { OccupiedCell } from "./types";

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
