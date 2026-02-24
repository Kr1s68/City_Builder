/**
 * WGSL shaders for texture-mapped entity rendering.
 *
 * These shaders sample from a GPU texture rather than outputting a flat colour.
 * The vertex buffer supplies (x, y, u, v) per vertex — position + UV coordinates.
 *
 * Bind groups:
 *   @group(0) @binding(0) — viewProj : mat4x4f (uniform buffer, vertex stage).
 *   @group(1) @binding(0) — texSampler : sampler (nearest-neighbour filtering).
 *   @group(1) @binding(1) — texImage : texture_2d<f32> (the sprite atlas / texture).
 *
 * The two-group layout exists because the uniform buffer is shared across all
 * pipelines, while the texture bindings are specific to textured rendering.
 *
 * Note on UVs: UVs are vertically flipped (v=1 at top, v=0 at bottom) to match
 * the coordinate system used by buildTexturedQuads().
 */

/**
 * Full-opacity textured shader.
 * Outputs the sampled texel colour as-is, with alpha from the texture.
 * Used for placed textured buildings.
 */
export const TEXTURED_SHADER = /* wgsl */ `
struct Uniforms { viewProj : mat4x4f };
@group(0) @binding(0) var<uniform> u : Uniforms;

// Texture bindings — separate bind group so we can reuse the uniform group.
@group(1) @binding(0) var texSampler : sampler;
@group(1) @binding(1) var texImage   : texture_2d<f32>;

struct VsOut {
  @builtin(position) pos : vec4f,
  @location(0) uv : vec2f,
};

@vertex fn vs(@location(0) pos : vec2f, @location(1) uv : vec2f) -> VsOut {
  var out : VsOut;
  out.pos = u.viewProj * vec4f(pos, 0.0, 1.0);
  out.uv  = uv;
  return out;
}

@fragment fn fs(@location(0) uv : vec2f) -> @location(0) vec4f {
  return textureSample(texImage, texSampler, uv);
}
`;

/**
 * Ghost / preview textured shader.
 * Same as TEXTURED_SHADER but multiplies the output alpha by 0.4
 * to produce a semi-transparent "ghost" effect when the player hovers
 * a textured building for placement.
 */
export const TEXTURED_PREVIEW_SHADER = /* wgsl */ `
struct Uniforms { viewProj : mat4x4f };
@group(0) @binding(0) var<uniform> u : Uniforms;

@group(1) @binding(0) var texSampler : sampler;
@group(1) @binding(1) var texImage   : texture_2d<f32>;

struct VsOut {
  @builtin(position) pos : vec4f,
  @location(0) uv : vec2f,
};

@vertex fn vs(@location(0) pos : vec2f, @location(1) uv : vec2f) -> VsOut {
  var out : VsOut;
  out.pos = u.viewProj * vec4f(pos, 0.0, 1.0);
  out.uv  = uv;
  return out;
}

@fragment fn fs(@location(0) uv : vec2f) -> @location(0) vec4f {
  var col = textureSample(texImage, texSampler, uv);
  col.a *= 0.4;
  return col;
}
`;
