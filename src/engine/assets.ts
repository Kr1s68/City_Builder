/** Asset loader — builds a texture atlas from individual building PNGs.
 *
 *  Loads each building sprite, composites them into a single atlas texture,
 *  and returns per-building-type UV regions for the textured quad builder.
 */

import type { BuildingType } from "../game/buildings";

/** UV region within the atlas for a single building type. */
export interface UVRegion {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/** Atlas cell size in pixels. Each building sprite is rasterised into this. */
const CELL = 128;
/** Atlas layout: 4 columns × 2 rows. */
const COLS = 4;
const ROWS = 2;

/** Ordered list of building types — determines atlas layout position. */
const ATLAS_ORDER: BuildingType[] = [
  "house",
  "town_hall",
  "lumber_mill",
  "quarry",
  "farm",
  "storage",
  "market",
  "wall",
];

/** Maps a building type to its PNG sprite filename. */
const SPRITE_FILES: Record<BuildingType, string> = {
  house: "house.png",
  town_hall: "town-hall.png",
  lumber_mill: "lumber-mill.png",
  quarry: "quarry.png",
  farm: "farm.png",
  storage: "storage.png",
  market: "market.png",
  wall: "blacksmith-pre.png", // placeholder until a wall sprite is made
};

/** Maps a building type to a sprite URL. */
function spriteUrl(type: BuildingType): string {
  return `/textures/buildings/${SPRITE_FILES[type]}`;
}

/** Load a PNG as an ImageBitmap at the target pixel size. */
async function loadBitmap(
  url: string,
  w: number,
  h: number,
): Promise<ImageBitmap> {
  const res = await fetch(url);
  const blob = await res.blob();
  return createImageBitmap(blob, { resizeWidth: w, resizeHeight: h });
}

/** Result returned by buildAtlas(). */
export interface AtlasResult {
  /** The composited atlas uploaded to a GPUTexture. */
  texture: GPUTexture;
  /** Per-building-type UV regions. */
  uvMap: ReadonlyMap<string, UVRegion>;
}

/**
 * Loads all building PNG sprites, composites them into a single atlas,
 * uploads to a GPUTexture, and returns UV lookup data.
 */
export async function buildAtlas(device: GPUDevice): Promise<AtlasResult> {
  // Load all sprites as ImageBitmaps at atlas cell size.
  const bitmaps = await Promise.all(
    ATLAS_ORDER.map((t) => loadBitmap(spriteUrl(t), CELL, CELL)),
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

  device.queue.copyExternalImageToTexture({ source: bitmap }, { texture }, [
    atlasW,
    atlasH,
  ]);
  bitmap.close();

  return { texture, uvMap };
}
