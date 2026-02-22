/** WGSL shader sources. */

/**
 * HOW SHADERS WORK IN THIS RENDERER
 * ------------------------------------
 * Every shader here follows the same minimal pattern:
 *
 *  1. Uniforms block  — declares `u.viewProj`, the 4×4 matrix uploaded from JS each frame.
 *  2. Vertex stage    — runs once per vertex; multiplies the 2D position by the matrix to get
 *                       the final clip-space position the GPU uses for rasterisation.
 *  3. Fragment stage  — runs once per pixel covered by a primitive; just returns a hard-coded
 *                       RGBA colour (no textures yet).
 *
 * The vertex shader receives `pos : vec2f` from @location(0) — that's the (x, y) world-space
 * coordinate packed into the vertex buffer by buildQuads() / the grid data builder.
 * z is forced to 0 (flat 2-D scene) and w to 1 (standard homogeneous coordinate).
 */

// ---------------------------------------------------------------------------
// Grid lines
// ---------------------------------------------------------------------------

/**
 * Renders the background grid as individual line segments.
 * Colour: light gray  rgb(0.75, 0.75, 0.75) — fully opaque.
 * The pipeline for this shader uses "line-list" topology, so every pair of
 * consecutive vertices in the buffer defines one line segment.
 */
export const GRID_SHADER = /* wgsl */ `
struct Uniforms { viewProj : mat4x4f };
@group(0) @binding(0) var<uniform> u : Uniforms;

@vertex fn vs(@location(0) pos : vec2f) -> @builtin(position) vec4f {
  // Promote the 2-D world position to a 4-D homogeneous vector, then
  // project it into clip space using the view-projection matrix.
  return u.viewProj * vec4f(pos, 0.0, 1.0);
}

@fragment fn fs() -> @location(0) vec4f {
  // Every grid-line pixel is the same flat light-gray, fully opaque.
  return vec4f(0.75, 0.75, 0.75, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Filled building quads
// ---------------------------------------------------------------------------

/**
 * Renders placed buildings as solid filled rectangles.
 * Colour: green  rgb(0.2, 0.7, 0.3) — fully opaque.
 * Uses "triangle-list" topology: every 3 vertices form one triangle,
 * and each quad is made of 2 triangles (6 vertices total).
 * No alpha blending needed — the colour completely overwrites what's behind.
 */
export const QUAD_SHADER = /* wgsl */ `
struct Uniforms { viewProj : mat4x4f };
@group(0) @binding(0) var<uniform> u : Uniforms;

@vertex fn vs(@location(0) pos : vec2f) -> @builtin(position) vec4f {
  return u.viewProj * vec4f(pos, 0.0, 1.0);
}

@fragment fn fs() -> @location(0) vec4f {
  // Solid green — represents a confirmed placed building tile.
  return vec4f(0.2, 0.7, 0.3, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Placement preview (ghost)
// ---------------------------------------------------------------------------

/**
 * Renders the "ghost" quad shown while the player is hovering a tile to place.
 * Colour: light green  rgba(0.2, 0.8, 0.3, 0.3) — 30% opaque so the grid shows through.
 * The pipeline for this shader enables standard alpha blending:
 *   finalColour = src.rgb * src.a  +  dst.rgb * (1 − src.a)
 * which is the classic "paint over" / "over" compositing operation.
 */
export const PREVIEW_SHADER = /* wgsl */ `
struct Uniforms { viewProj : mat4x4f };
@group(0) @binding(0) var<uniform> u : Uniforms;

@vertex fn vs(@location(0) pos : vec2f) -> @builtin(position) vec4f {
  return u.viewProj * vec4f(pos, 0.0, 1.0);
}

@fragment fn fs() -> @location(0) vec4f {
  // Semi-transparent light green — gives the player feedback on where a building
  // will land without fully hiding what is already on the tile.
  return vec4f(0.2, 0.8, 0.3, 0.3);
}
`;

// ---------------------------------------------------------------------------
// Moveable entity highlight
// ---------------------------------------------------------------------------

/**
 * Renders an entity that the player is currently dragging / repositioning.
 * Colour: red-ish  rgba(0.85, 0.2, 0.2, 0.55) — 55% opaque.
 * Same alpha-blending pipeline as the preview shader, just a different colour
 * to communicate "this object is being moved, not placed".
 */
export const MOVEABLE_SHADER = /* wgsl */ `
struct Uniforms { viewProj : mat4x4f };
@group(0) @binding(0) var<uniform> u : Uniforms;

@vertex fn vs(@location(0) pos : vec2f) -> @builtin(position) vec4f {
  return u.viewProj * vec4f(pos, 0.0, 1.0);
}

@fragment fn fs() -> @location(0) vec4f {
  // Semi-transparent red — signals to the player that this tile's entity
  // is currently selected for repositioning.
  return vec4f(0.85, 0.2, 0.2, 0.55);
}
`;
