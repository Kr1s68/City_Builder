/** Asset loader — builds a texture atlas from individual building SVGs.
 *
 *  Loads each building sprite, composites them into a single atlas texture,
 *  and returns per-building-type UV regions for the textured quad builder.
 */

import type { BuildingType } from "../game/buildings";

/** UV region within the atlas for a single building type. */
export interface UVRegion {
  u0: number; v0: number;
  u1: number; v1: number;
}

/** Atlas cell size in pixels. Each building sprite is rasterised into this. */
const CELL = 128;
/** Atlas layout: 4 columns × 2 rows. */
const COLS = 4;
const ROWS = 2;

/** Ordered list of building types — determines atlas layout position. */
const ATLAS_ORDER: BuildingType[] = [
  "house", "town_hall", "lumber_mill", "quarry",
  "farm",  "storage",   "market",      "wall",
];

/** Maps a building type to a sprite URL. */
function spriteUrl(type: BuildingType): string {
  return `/textures/buildings/${type}.svg`;
}

/** Load a single image from a URL. */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/** Result returned by buildAtlas(). */
export interface AtlasResult {
  /** The composited atlas uploaded to a GPUTexture. */
  texture: GPUTexture;
  /** Per-building-type UV regions. */
  uvMap: ReadonlyMap<string, UVRegion>;
}

/**
 * Loads all building SVG sprites, composites them into a single atlas,
 * uploads to a GPUTexture, and returns UV lookup data.
 */
export async function buildAtlas(device: GPUDevice): Promise<AtlasResult> {
  // Load all sprites in parallel.
  const images = await Promise.all(ATLAS_ORDER.map(t => loadImage(spriteUrl(t))));

  // Composite onto an offscreen canvas.
  const atlasW = COLS * CELL;
  const atlasH = ROWS * CELL;
  const canvas = new OffscreenCanvas(atlasW, atlasH);
  const ctx = canvas.getContext("2d")!;

  // Ensure transparent background.
  ctx.clearRect(0, 0, atlasW, atlasH);

  const uvMap = new Map<string, UVRegion>();

  for (let i = 0; i < ATLAS_ORDER.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL;
    const y = row * CELL;

    ctx.drawImage(images[i], x, y, CELL, CELL);

    uvMap.set(ATLAS_ORDER[i], {
      u0: col / COLS,
      v0: row / ROWS,
      u1: (col + 1) / COLS,
      v1: (row + 1) / ROWS,
    });
  }

  // Upload to GPU.
  const bitmap = await createImageBitmap(canvas);
  const texture = device.createTexture({
    size: [atlasW, atlasH],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture },
    [atlasW, atlasH],
  );
  bitmap.close();

  return { texture, uvMap };
}
