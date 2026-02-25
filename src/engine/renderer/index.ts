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

import type { Renderer, TexturedEntity } from "./types";
import { setupGPU } from "./setup";
import { buildAtlas, loadSvgTexture } from "../assets";
import {
  createGridPipeline,
  createQuadPipeline,
  createPreviewPipeline,
  createMoveablePipeline,
  createPathPipeline,
  createTexturedPipeline,
  createTexturedPreviewPipeline,
} from "./pipelines/index";
import { createFlatLayer, createTexturedLayer, updateTexturedLayer } from "./layers";
import { createFrameFn } from "./frame";
import { GRID_COLS, GRID_ROWS } from "../../game/grid";

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

  // --- Load building atlas & world texture in parallel --------------------
  const [atlas, worldTexture] = await Promise.all([
    buildAtlas(device),
    loadSvgTexture(device, "/textures/world.svg", 128, 128),
  ]);

  // --- Build render layers ------------------------------------------------
  const backgroundLayer = createTexturedLayer(createTexturedPipeline(gpuCtx, worldTexture));

  // Pre-fill the background layer with a single quad covering the whole grid.
  const bgEntity: TexturedEntity = {
    col: 0, row: 0,
    width: GRID_COLS, height: GRID_ROWS,
    type: "__background",
  };
  updateTexturedLayer(backgroundLayer, device, [bgEntity]);

  const layers = {
    background:      backgroundLayer,
    path:            createFlatLayer(createPathPipeline(gpuCtx)),
    quad:            createFlatLayer(createQuadPipeline(gpuCtx)),
    textured:        createTexturedLayer(createTexturedPipeline(gpuCtx, atlas.texture)),
    moveable:        createFlatLayer(createMoveablePipeline(gpuCtx)),
    preview:         createFlatLayer(createPreviewPipeline(gpuCtx)),
    texturedPreview: createTexturedLayer(createTexturedPreviewPipeline(gpuCtx, atlas.texture)),
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
      atlas.uvMap,
    ),
  };

  return state;
}
