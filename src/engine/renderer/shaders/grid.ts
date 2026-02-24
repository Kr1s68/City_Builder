/**
 * WGSL shader for the background grid overlay.
 *
 * Renders individual line segments using "line-list" topology.
 * Each pair of consecutive vertices in the vertex buffer defines one line.
 *
 * Vertex input:
 *   @location(0) pos : vec2f — world-space (x, y) endpoint.
 *
 * Uniform binding:
 *   @group(0) @binding(0) viewProj : mat4x4f — camera view-projection matrix,
 *   uploaded from JS every frame via a shared 64-byte uniform buffer.
 *
 * Output colour: light gray rgb(0.75, 0.75, 0.75), fully opaque.
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
