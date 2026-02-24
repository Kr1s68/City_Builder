/**
 * Renderer entry — initialises WebGPU and orchestrates per-frame drawing.
 *
 * This module is the only public surface of the renderer. It wires together:
 *   - WebGPU bootstrap (setup.ts)
 *   - Pipeline compilation (pipelines/)
 *   - Render layer management (layers.ts)
 *   - Per-frame draw orchestration (frame.ts)
 */

export type { Renderer, OccupiedCell, TexturedEntity } from "./types";

import type { Renderer } from "./types";
import { setupGPU, loadTexture } from "./setup";
import {
  createGridPipeline,
  createQuadPipeline,
  createPreviewPipeline,
  createMoveablePipeline,
  createPathPipeline,
  createTexturedPipeline,
  createTexturedPreviewPipeline,
} from "./pipelines/index";
import { createFlatLayer, createTexturedLayer } from "./layers";
import { createFrameFn } from "./frame";

/**
 * Initialises the WebGPU renderer and returns a Renderer handle.
 *
 * @param canvas       The HTML canvas to render into.
 * @param gridLineData Pre-built flat (x,y) vertex array for all grid lines.
 */
export async function initRenderer(
  canvas: HTMLCanvasElement,
  gridLineData: Float32Array,
): Promise<Renderer> {
  // --- WebGPU bootstrap ---------------------------------------------------
  const { device, context, format, gpuCtx, bindGroup, uniformBuffer } =
    await setupGPU(canvas);

  // --- Compile pipelines (one-time) ---------------------------------------
  const grid = createGridPipeline(gpuCtx, gridLineData);
  const houseTexture = await loadTexture(device, "/textures/buildings/house-placeholder.png");

  // --- Build render layers ------------------------------------------------
  const layers = {
    path:            createFlatLayer(createPathPipeline(gpuCtx)),
    quad:            createFlatLayer(createQuadPipeline(gpuCtx)),
    textured:        createTexturedLayer(createTexturedPipeline(gpuCtx, houseTexture)),
    moveable:        createFlatLayer(createMoveablePipeline(gpuCtx)),
    preview:         createFlatLayer(createPreviewPipeline(gpuCtx)),
    texturedPreview: createTexturedLayer(createTexturedPreviewPipeline(gpuCtx, houseTexture)),
    grid,
  };

  // --- Assemble the public Renderer handle --------------------------------
  const state: Renderer = {
    device,
    context,
    format,
    canvas,
    showGrid: false,
    frame: createFrameFn(
      { device, context, uniformBuffer, bindGroup },
      layers,
      // Pass `state` itself so frame() reads the live showGrid value.
      // Safe because `state` is defined before frame() is ever called.
      { get showGrid() { return state.showGrid; } },
    ),
  };

  return state;
}
