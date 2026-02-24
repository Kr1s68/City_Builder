/**
 * WGSL shader for the placement preview ("ghost") overlay.
 *
 * Renders a semi-transparent quad under the player's cursor while hovering
 * to indicate where a building will be placed.
 *
 * Vertex input:
 *   @location(0) pos : vec2f — world-space (x, y) corner position.
 *
 * Uniform binding:
 *   @group(0) @binding(0) viewProj : mat4x4f — camera view-projection matrix.
 *
 * Output colour: light green rgba(0.2, 0.8, 0.3, 0.3) — 30% opaque.
 * The pipeline for this shader enables standard "src-over" alpha blending
 * so the grid and other layers show through the ghost.
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
