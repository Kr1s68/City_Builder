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

/** Load an SVG as an ImageBitmap at the target pixel size.
 *  Uses Image + data URI for maximum browser compatibility. */
async function loadSvgBitmap(url: string, w: number, h: number): Promise<ImageBitmap> {
  const res = await fetch(url);
  const text = await res.text();

  // Inject width/height so the browser knows the rasterisation size.
  const sized = text.replace(/<svg\s/, `<svg width="${w}" height="${h}" `);

  // Render SVG → Image via data URI, then extract an ImageBitmap.
  const dataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sized);
  const img = new Image(w, h);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to decode SVG: ${url}`));
    img.src = dataUri;
  });
  return createImageBitmap(img, { resizeWidth: w, resizeHeight: h });
}

/**
 * Loads an SVG from a URL and uploads it as a GPUTexture.
 * Uses the same Image + data URI approach as the atlas builder.
 */
export async function loadSvgTexture(device: GPUDevice, url: string, w: number, h: number): Promise<GPUTexture> {
  const bitmap = await loadSvgBitmap(url, w, h);
  const texture = device.createTexture({
    size: [w, h],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture },
    [w, h],
  );
  bitmap.close();
  return texture;
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
  // Load all sprites as ImageBitmaps at atlas cell size.
  const bitmaps = await Promise.all(
    ATLAS_ORDER.map(t => loadSvgBitmap(spriteUrl(t), CELL, CELL)),
  );

  // Composite onto an offscreen canvas.
  const atlasW = COLS * CELL;
  const atlasH = ROWS * CELL;
  const canvas = new OffscreenCanvas(atlasW, atlasH);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, atlasW, atlasH);

  const uvMap = new Map<string, UVRegion>();

  for (let i = 0; i < ATLAS_ORDER.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL;
    const y = row * CELL;

    ctx.drawImage(bitmaps[i], x, y, CELL, CELL);
    bitmaps[i].close();

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
