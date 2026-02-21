/** Quad geometry helpers — builds triangle-list vertex data from cell coordinates. */

import { CELL_SIZE } from "../../game/grid";
import type { OccupiedCell } from "./types";

/** Maximum cells we can render per draw call. */
export const MAX_QUADS = 4096;

/** Floats per quad: 2 triangles × 3 verts × 2 floats. */
export const FLOATS_PER_QUAD = 12;

/**
 * Write quad vertex data for a list of cells into a CPU buffer
 * and upload to the corresponding GPU buffer.
 * Returns the number of quads written.
 */
export function buildQuads(
  device: GPUDevice,
  cells: OccupiedCell[],
  cpuBuf: Float32Array,
  gpuBuf: GPUBuffer,
): number {
  const count = Math.min(cells.length, MAX_QUADS);
  for (let i = 0; i < count; i++) {
    const c = cells[i];
    const x0 = c.col * CELL_SIZE;
    const y0 = c.row * CELL_SIZE;
    const x1 = x0 + CELL_SIZE;
    const y1 = y0 + CELL_SIZE;
    const off = i * FLOATS_PER_QUAD;
    cpuBuf[off + 0] = x0; cpuBuf[off + 1] = y0;
    cpuBuf[off + 2] = x1; cpuBuf[off + 3] = y0;
    cpuBuf[off + 4] = x0; cpuBuf[off + 5] = y1;
    cpuBuf[off + 6] = x1; cpuBuf[off + 7] = y0;
    cpuBuf[off + 8] = x1; cpuBuf[off + 9] = y1;
    cpuBuf[off + 10] = x0; cpuBuf[off + 11] = y1;
  }
  if (count > 0) {
    device.queue.writeBuffer(gpuBuf, 0, cpuBuf as Float32Array<ArrayBuffer>, 0, count * FLOATS_PER_QUAD);
  }
  return count;
}
