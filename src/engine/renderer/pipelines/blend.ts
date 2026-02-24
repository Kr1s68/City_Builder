/**
 * Reusable alpha blend state configuration.
 *
 * Standard "src-over" / "Porter-Duff over" compositing used by all
 * semi-transparent pipelines (preview ghost, moveable highlight,
 * textured preview, and textured buildings with transparency).
 *
 * Blend formula (per channel):
 *   out.rgb = src.rgb * src.a  +  dst.rgb * (1 - src.a)
 *   out.a   = src.a  * 1      +  dst.a   * (1 - src.a)
 */
export const ALPHA_BLEND: GPUBlendState = {
  color: {
    srcFactor: "src-alpha",           // weight new pixel by its own alpha
    dstFactor: "one-minus-src-alpha", // weight existing pixel by (1 - new alpha)
    operation: "add",
  },
  alpha: {
    srcFactor: "one",                 // keep the full source alpha
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
};
