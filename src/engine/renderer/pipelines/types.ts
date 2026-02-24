/**
 * Return types for pipeline factory functions.
 *
 * Each pipeline factory returns one of these interfaces so the caller
 * (the renderer) knows what GPU resources are available for drawing.
 */

/**
 * A compiled grid render pipeline with its pre-filled vertex buffer.
 *
 * Unlike quad pipelines, the grid's vertex data is uploaded once at
 * startup and never changes — so vertexCount is known at creation time.
 */
export interface GridPipeline {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  /** Number of vertices in the buffer (gridLineData.length / 2). */
  vertexCount: number;
}

/**
 * A compiled quad render pipeline with a dynamic vertex buffer.
 *
 * The vertex buffer is pre-allocated at max capacity; the actual vertex
 * count changes each frame and is tracked externally by the renderer.
 */
export interface QuadPipeline {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
}

/**
 * A compiled textured render pipeline with its own bind groups.
 *
 * Textured pipelines use a different pipeline layout (two bind groups)
 * so they carry their own uniform and texture bind groups rather than
 * sharing the flat-colour pipeline's single bind group.
 */
export interface TexturedPipeline {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  /** Bind group for the uniform buffer (group 0) — separate from the shared one. */
  uniformBindGroup: GPUBindGroup;
  /** Bind group for the sampler + texture (group 1). */
  textureBindGroup: GPUBindGroup;
}
