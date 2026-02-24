/**
 * WGSL shader for the moveable entity highlight.
 *
 * Renders a semi-transparent overlay on entities that the player is
 * currently dragging or repositioning. The red tint communicates
 * "this object is being moved, not placed".
 *
 * Vertex input:
 *   @location(0) pos : vec2f — world-space (x, y) corner position.
 *
 * Uniform binding:
 *   @group(0) @binding(0) viewProj : mat4x4f — camera view-projection matrix.
 *
 * Output colour: red-ish rgba(0.85, 0.2, 0.2, 0.55) — 55% opaque.
 * The pipeline enables standard alpha blending (same as the preview shader).
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
