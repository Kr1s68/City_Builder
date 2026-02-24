/**
 * Per-frame rendering logic.
 *
 * Owns the render pass recording and layer draw orchestration.
 * Extracted from initRenderer() to keep the entry point focused
 * on one-time setup.
 */

import type { OccupiedCell, TexturedEntity } from "./types";
import type { GridPipeline } from "./pipelines/index";
import {
  type FlatLayer,
  type TexturedLayer,
  updateFlatLayer,
  updateTexturedLayer,
  drawFlatLayer,
  drawTexturedLayer,
  drawGridLayer,
} from "./layers";

/** All the render layers created at init time, in draw order. */
export interface FrameLayers {
  path: FlatLayer;
  quad: FlatLayer;
  textured: TexturedLayer;
  moveable: FlatLayer;
  preview: FlatLayer;
  texturedPreview: TexturedLayer;
  grid: GridPipeline;
}

/** Shared GPU handles needed each frame. */
interface FrameContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
}

/**
 * Creates the frame callback that the game loop calls each tick.
 *
 * @param fCtx   Shared GPU handles (device, context, uniform buffer, bind group).
 * @param layers All render layers in draw order.
 * @param state  Mutable renderer state (showGrid flag).
 */
export function createFrameFn(
  fCtx: FrameContext,
  layers: FrameLayers,
  state: { showGrid: boolean },
) {
  const { device, context, uniformBuffer, bindGroup } = fCtx;

  return function frame(
    viewProj: Float32Array,
    occupiedCells: OccupiedCell[],
    previewCells?: OccupiedCell[],
    moveableCells?: OccupiedCell[],
    pathCells?: OccupiedCell[],
    texturedEntities?: TexturedEntity[],
    previewTexturedEntities?: TexturedEntity[],
  ): void {
    // 1. Upload the updated camera matrix.
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      viewProj as Float32Array<ArrayBuffer>,
    );

    // 2. Build geometry for each layer and upload to GPU vertex buffers.
    updateFlatLayer(layers.path, device, pathCells);
    updateFlatLayer(layers.quad, device, occupiedCells);
    updateTexturedLayer(layers.textured, device, texturedEntities);
    updateFlatLayer(layers.moveable, device, moveableCells);
    updateFlatLayer(layers.preview, device, previewCells);
    updateTexturedLayer(layers.texturedPreview, device, previewTexturedEntities);

    // 3. Record the render pass.
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.22, g: 0.45, b: 0.15, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    // Draw layers back-to-front.
    drawFlatLayer(layers.path, pass, bindGroup);         // Layer 1: roads
    drawFlatLayer(layers.quad, pass, bindGroup);         // Layer 2: buildings (flat)
    drawTexturedLayer(layers.textured, pass);            // Layer 2b: buildings (textured)
    drawFlatLayer(layers.moveable, pass, bindGroup);     // Layer 3: moveable highlight
    drawFlatLayer(layers.preview, pass, bindGroup);      // Layer 4: placement ghost
    drawTexturedLayer(layers.texturedPreview, pass);     // Layer 4b: textured ghost

    // Layer 5: Grid overlay (conditional).
    if (state.showGrid) {
      drawGridLayer(layers.grid, pass, bindGroup);
    }

    pass.end();

    // 4. Submit to the GPU.
    device.queue.submit([encoder.finish()]);
  };
}
