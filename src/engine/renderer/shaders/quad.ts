/**
 * WGSL shader for solid, opaque building quads.
 *
 * Renders placed buildings as filled rectangles using "triangle-list" topology.
 * Each quad is composed of 2 triangles (6 vertices).
 *
 * Vertex input:
 *   @location(0) pos : vec2f — world-space (x, y) corner position.
 *
 * Uniform binding:
 *   @group(0) @binding(0) viewProj : mat4x4f — camera view-projection matrix.
 *
 * Output colour: green rgb(0.2, 0.7, 0.3), fully opaque.
 * No alpha blending — the colour completely overwrites what is behind it.
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
