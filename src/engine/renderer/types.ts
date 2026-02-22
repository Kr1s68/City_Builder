/** Shared renderer types. */

/**
 * Represents a single grid cell that is "in use" by a building or entity.
 * col = column index (x-axis), row = row index (y-axis).
 * All rendering layers (placed, preview, moveable) use this same coordinate
 * unit — world-space positions are derived by multiplying by CELL_SIZE.
 */
export interface OccupiedCell {
  col: number;
  row: number;
}

/**
 * The public handle returned by initRenderer().
 * The game loop holds one of these and calls frame() each tick.
 */
export interface Renderer {
  /** The raw WebGPU logical device — used to create buffers, pipelines, etc. */
  device: GPUDevice;

  /** The WebGPU swap-chain context tied to the canvas — provides the texture we draw into each frame. */
  context: GPUCanvasContext;

  /** The swap-chain texture format (e.g. "bgra8unorm"). Must match what all pipelines are compiled against. */
  format: GPUTextureFormat;

  /** The HTML canvas element we render into. */
  canvas: HTMLCanvasElement;

  /** When true the grid-line layer is drawn on top of everything else. Toggle freely at runtime. */
  showGrid: boolean;

  /**
   * Renders a single frame.
   * @param viewProj     Column-major 4×4 view-projection matrix (64 bytes) that maps world space → clip space.
   * @param occupiedCells  Cells that have placed buildings — drawn as solid green quads.
   * @param previewCells   Optional. Cells shown as a semi-transparent ghost while the player hovers a placement.
   * @param moveableCells  Optional. Cells highlighted in semi-transparent red to indicate a moveable entity.
   */
  frame: (
    viewProj: Float32Array,
    occupiedCells: OccupiedCell[],
    previewCells?: OccupiedCell[],
    moveableCells?: OccupiedCell[],
  ) => void;
}

/**
 * A bundle of GPU objects that every pipeline needs.
 * Created once in initRenderer() and passed into each createXxxPipeline() helper
 * so they don't have to re-create shared state.
 */
export interface GPUContext {
  /** The logical GPU device — the main entry point for creating GPU resources. */
  device: GPUDevice;

  /** Swap-chain texture format — pipelines must target this exact format. */
  format: GPUTextureFormat;

  /**
   * Describes which bind groups each pipeline accepts.
   * Here: one bind group containing one uniform buffer (the view-projection matrix).
   */
  pipelineLayout: GPUPipelineLayout;

  /**
   * Tells the GPU how to read vertex data out of a vertex buffer.
   * Here: each vertex is 8 bytes (2 × float32) — just an (x, y) position.
   */
  vertexBufferLayout: GPUVertexBufferLayout;

  /**
   * The actual binding of the uniform buffer to slot @binding(0).
   * Passed to pass.setBindGroup() each draw call so the shader can read the matrix.
   */
  bindGroup: GPUBindGroup;

  /**
   * A 64-byte GPU buffer that holds the current frame's view-projection matrix.
   * Written to every frame via device.queue.writeBuffer().
   */
  uniformBuffer: GPUBuffer;
}
