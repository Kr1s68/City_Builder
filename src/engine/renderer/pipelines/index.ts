/**
 * Barrel export for all render pipeline factories, types, and constants.
 *
 * Pipeline factories are organized by rendering purpose:
 *   - grid.ts      — Background grid (line-list, opaque).
 *   - quad.ts      — Solid building quads (triangle-list, opaque).
 *   - preview.ts   — Placement ghost (triangle-list, alpha-blended).
 *   - path.ts      — Road / path network (triangle-list, opaque).
 *   - moveable.ts  — Moveable entity highlight (triangle-list, alpha-blended).
 *   - textured.ts  — Texture-mapped pipelines (full opacity + ghost preview).
 *
 * Shared infrastructure:
 *   - types.ts     — Return types for pipeline factories (GridPipeline, QuadPipeline, TexturedPipeline).
 *   - constants.ts — Pre-computed buffer size constants.
 *   - blend.ts     — Reusable alpha blend state configuration.
 */

// --- Types ---
export type { GridPipeline, QuadPipeline, TexturedPipeline } from "./types";

// --- Pipeline factories ---
export { createGridPipeline } from "./grid";
export { createQuadPipeline } from "./quad";
export { createPreviewPipeline } from "./preview";
export { createPathPipeline } from "./path";
export { createMoveablePipeline } from "./moveable";
export { createTexturedPipeline, createTexturedPreviewPipeline } from "./textured";
