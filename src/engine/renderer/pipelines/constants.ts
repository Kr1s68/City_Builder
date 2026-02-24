/**
 * Pre-computed buffer size constants for quad vertex buffers.
 *
 * All vertex buffers are allocated at maximum capacity once at startup.
 * Only the used portion is uploaded each frame — this avoids runtime
 * reallocation and GPU buffer resizing.
 */

/**
 * Maximum number of quads any single pipeline layer can render per frame.
 * Shared across all flat-colour and textured pipelines.
 */
export const MAX_QUADS = 4096;

/**
 * Size in bytes for a flat-colour quad vertex buffer at maximum capacity.
 *
 * Layout: 4096 quads x 6 vertices/quad x 2 floats/vertex x 4 bytes/float
 *       = 4096 x 12 x 4 = 196 608 bytes (~192 KB).
 *
 * Each vertex has 2 floats (x, y). Each quad is 2 triangles = 6 vertices.
 */
export const MAX_QUAD_BUFFER_SIZE = MAX_QUADS * 12 * 4;

/**
 * Size in bytes for a textured quad vertex buffer at maximum capacity.
 *
 * Layout: 4096 quads x 6 vertices/quad x 4 floats/vertex x 4 bytes/float
 *       = 4096 x 24 x 4 = 393 216 bytes (~384 KB).
 *
 * Each vertex has 4 floats (x, y, u, v) — position + texture coordinates.
 */
export const MAX_QUAD_BUFFER_SIZE_TEXTURED = MAX_QUADS * 24 * 4;
