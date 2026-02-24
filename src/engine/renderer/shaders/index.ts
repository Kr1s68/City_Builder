/**
 * Barrel export for all WGSL shader source strings.
 *
 * Each shader is defined in its own module, grouped by rendering purpose:
 *   - grid.ts      — Background grid overlay (line-list topology).
 *   - quad.ts      — Solid opaque building quads (triangle-list).
 *   - preview.ts   — Semi-transparent placement ghost (alpha-blended).
 *   - path.ts      — Road / path network cells (opaque).
 *   - moveable.ts  — Moveable entity highlight (alpha-blended red).
 *   - textured.ts  — Texture-mapped shaders (full opacity + ghost preview).
 *
 * All shaders share the same vertex-stage uniform binding pattern:
 *   @group(0) @binding(0) viewProj : mat4x4f
 * Textured shaders additionally use @group(1) for sampler + texture bindings.
 */

export { GRID_SHADER } from "./grid";
export { QUAD_SHADER } from "./quad";
export { PREVIEW_SHADER } from "./preview";
export { PATH_SHADER } from "./path";
export { MOVEABLE_SHADER } from "./moveable";
export { TEXTURED_SHADER, TEXTURED_PREVIEW_SHADER } from "./textured";
