/** Shared renderer types. */

export interface OccupiedCell {
  col: number;
  row: number;
}

export interface Renderer {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  canvas: HTMLCanvasElement;
  /** Whether to draw grid lines. Toggle at runtime. */
  showGrid: boolean;
  /** Render one frame. Pass viewProj, placed cells, optional preview cells, and optional moveable cells. */
  frame: (viewProj: Float32Array, occupiedCells: OccupiedCell[], previewCells?: OccupiedCell[], moveableCells?: OccupiedCell[]) => void;
}

/** Shared GPU resources used across all pipelines. */
export interface GPUContext {
  device: GPUDevice;
  format: GPUTextureFormat;
  pipelineLayout: GPUPipelineLayout;
  vertexBufferLayout: GPUVertexBufferLayout;
  bindGroup: GPUBindGroup;
  uniformBuffer: GPUBuffer;
}
