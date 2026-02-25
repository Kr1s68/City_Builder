# Camera Configuration Guide

All camera and isometric projection settings live in a single file:

```
src/engine/cameraConfig.ts
```

Edit the `CAMERA_CONFIG` object to change any value. Changes take effect
immediately (values are read each frame at runtime).

---

## Zoom Settings

| Property       | Default | Description                                        |
| -------------- | ------- | -------------------------------------------------- |
| `minZoom`      | `8`     | Most zoomed-out level. Lower = see more of the map |
| `maxZoom`      | `128`   | Most zoomed-in level. Higher = closer detail        |
| `defaultZoom`  | `40`    | Starting zoom when the game loads                   |
| `zoomSpeed`    | `1.1`   | Multiplier per scroll tick. 1.1 = 10% per tick      |

**Examples:**

```ts
// Very fast zoom (20% per tick, wider range)
CAMERA_CONFIG.minZoom = 4;
CAMERA_CONFIG.maxZoom = 256;
CAMERA_CONFIG.zoomSpeed = 1.2;

// Slow, constrained zoom
CAMERA_CONFIG.minZoom = 20;
CAMERA_CONFIG.maxZoom = 60;
CAMERA_CONFIG.zoomSpeed = 1.05;
```

---

## Pan Settings

| Property      | Default | Description                                           |
| ------------- | ------- | ----------------------------------------------------- |
| `panKeySpeed` | `8`     | WASD/arrow key pan speed in world units per second     |

The actual pan speed scales inversely with zoom (zoomed in = slower pan)
so movement feels consistent on screen.

```ts
// Faster keyboard panning
CAMERA_CONFIG.panKeySpeed = 16;
```

---

## Isometric Projection

These two values control the isometric skew that turns the flat grid into
a diamond-shaped isometric view.

| Property     | Default | Description                                    |
| ------------ | ------- | ---------------------------------------------- |
| `isoXFactor` | `1.0`   | Horizontal stretch of the isometric transform  |
| `isoYFactor` | `0.5`   | Vertical compression of the isometric transform |

### How they work

The isometric transform converts world coordinates to screen coordinates:

```
screen_x ∝ isoXFactor × (world_x − world_y)
screen_y ∝ isoYFactor × (world_x + world_y)
```

### `isoYFactor` — Viewing angle

This is the most impactful setting. It controls how "tilted" the camera
appears:

| Value  | Effect                                                     |
| ------ | ---------------------------------------------------------- |
| `0.25` | Very flat / top-down. Grid diamonds are wide and short     |
| `0.5`  | **Standard isometric** (default). Classic 2:1 diamond ratio |
| `0.75` | Steeper angle. Diamonds are taller, more side-on view       |
| `1.0`  | 45° diagonal. No vertical compression at all                |

```
isoYFactor = 0.25          isoYFactor = 0.5 (default)    isoYFactor = 0.75
    ◇ (very flat)              ◇ (standard)                 ◇ (steep)
   ◇◇◇                       ◇◇                            ◇
                              ◇◇                           ◇◇
                                                           ◇
```

### `isoXFactor` — Horizontal stretch

Controls the horizontal spread of the isometric grid:

| Value  | Effect                                               |
| ------ | ---------------------------------------------------- |
| `0.5`  | Compressed horizontally. Narrow, tall diamonds        |
| `1.0`  | **Standard** (default). Normal isometric proportions  |
| `1.5`  | Stretched horizontally. Wide diamonds                 |

Most games use `1.0`. Only change this if you want a non-standard look.

### Common presets

```ts
// Classic isometric (default)
CAMERA_CONFIG.isoXFactor = 1.0;
CAMERA_CONFIG.isoYFactor = 0.5;

// Flatter top-down view (good for strategy overview)
CAMERA_CONFIG.isoXFactor = 1.0;
CAMERA_CONFIG.isoYFactor = 0.3;

// Steeper, more dramatic angle
CAMERA_CONFIG.isoXFactor = 1.0;
CAMERA_CONFIG.isoYFactor = 0.7;

// Purely top-down (no isometric effect)
CAMERA_CONFIG.isoXFactor = 1.0;
CAMERA_CONFIG.isoYFactor = 1.0;
// Note: at 1.0/1.0 the grid is a 45° rotated square, not a diamond
```

---

## Billboard Sprite Settings

Buildings are rendered as upright billboard sprites that float above the
isometric grid. These settings control how much space the sprite quad
occupies beyond the building's grid footprint.

| Property         | Default | Description                                         |
| ---------------- | ------- | --------------------------------------------------- |
| `billboardPadX`  | `0.5`   | Horizontal padding (× CELL_SIZE) on each side       |
| `billboardPadUp` | `1.5`   | Vertical padding above footprint (× CELL_SIZE)      |

### `billboardPadX` — Side padding

Extends the sprite quad left and right in iso-space:

- `0.0` — Sprite exactly matches the footprint diamond width (may clip)
- `0.5` — Half a cell of padding on each side (default, works for most sprites)
- `1.0` — Full cell of padding (for sprites with wide overhangs)

### `billboardPadUp` — Height extension

Extends the sprite quad above the footprint diamond:

- `0.5` — Minimal height (good for flat things like farms or roads)
- `1.5` — Standard height (default, good for 1-2 story buildings)
- `3.0` — Very tall (for towers, castles, or tall structures)

If a building's roof or top is being clipped, increase `billboardPadUp`.
If sprites appear too spread out horizontally, decrease `billboardPadX`.

```ts
// Tighter billboards (less wasted transparent space)
CAMERA_CONFIG.billboardPadX = 0.3;
CAMERA_CONFIG.billboardPadUp = 1.2;

// Generous space for tall castle sprites
CAMERA_CONFIG.billboardPadX = 0.8;
CAMERA_CONFIG.billboardPadUp = 3.0;
```

---

## Quick Reference

```ts
// Full default configuration
export const CAMERA_CONFIG: CameraConfig = {
  minZoom: 8,
  maxZoom: 128,
  defaultZoom: 40,
  zoomSpeed: 1.1,
  panKeySpeed: 8,
  isoXFactor: 1.0,
  isoYFactor: 0.5,
  billboardPadX: 0.5,
  billboardPadUp: 1.5,
};
```

All values can be changed at runtime via the browser console for quick
experimentation:

```js
// In browser dev tools:
// (only works if CAMERA_CONFIG is exposed on window or via module import)
```

Or simply edit `src/engine/cameraConfig.ts` and let Vite hot-reload.
