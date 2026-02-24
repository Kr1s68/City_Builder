/**
 * WGSL shader for road / path cells.
 *
 * Renders the road network that connects buildings as solid filled quads.
 * Drawn before buildings in the render pass so building quads cover any
 * overlapping path cells underneath.
 *
 * Vertex input:
 *   @location(0) pos : vec2f — world-space (x, y) corner position.
 *
 * Uniform binding:
 *   @group(0) @binding(0) viewProj : mat4x4f — camera view-projection matrix.
 *
 * Output colour: gray rgb(0.55, 0.55, 0.55), fully opaque.
 */

export const PATH_SHADER = /* wgsl */ `
struct Uniforms { viewProj : mat4x4f };
@group(0) @binding(0) var<uniform> u : Uniforms;

@vertex fn vs(@location(0) pos : vec2f) -> @builtin(position) vec4f {
  return u.viewProj * vec4f(pos, 0.0, 1.0);
}

@fragment fn fs() -> @location(0) vec4f {
  // Solid gray — indicates a path cell connecting buildings.
  return vec4f(0.55, 0.55, 0.55, 1.0);
}
`;
