/** 2D isometric camera with pan and zoom.
 *
 *  Applies a classic isometric skew (45° rotation + Y compression)
 *  on top of an orthographic projection. All world coordinates are
 *  transformed so axis-aligned grid squares become diamonds.
 *
 *  Isometric mapping:
 *    screen_x ∝ world_x − world_y
 *    screen_y ∝ (world_x + world_y) × isoYFactor
 */

import { CAMERA_CONFIG } from "./cameraConfig";

export interface Camera {
  /** World-space X of the view centre. */
  x: number;
  /** World-space Y of the view centre. */
  y: number;
  /** Pixels per world unit. Higher = more zoomed in. */
  zoom: number;
}

/** Create a camera centred on (cx, cy). */
export function createCamera(cx: number, cy: number, zoom = CAMERA_CONFIG.defaultZoom): Camera {
  return { x: cx, y: cy, zoom };
}

/**
 * Build a column-major 4×4 isometric view-projection matrix.
 *
 * Composes an isometric skew with an orthographic projection:
 *   iso: (x, y) → (x − y, 0.5·(x + y))
 *   ortho: scale + translate to clip space [-1, 1]
 *
 * Result = ortho × iso (column-major).
 */
export function getViewProjectionMatrix(
  cam: Camera,
  canvasW: number,
  canvasH: number,
): Float32Array {
  const halfW = canvasW / (2 * cam.zoom);
  const halfH = canvasH / (2 * cam.zoom);

  const sx = 1 / halfW;
  const sy = 1 / halfH;

  const isoX = CAMERA_CONFIG.isoXFactor;
  const isoY = CAMERA_CONFIG.isoYFactor;

  // Camera centre in iso-space determines the translate.
  const tx = -sx * isoX * (cam.x - cam.y);
  const ty = -isoY * sy * (cam.x + cam.y);

  // Combined ortho × iso (column-major storage).
  // Column 0: iso x-basis (isoX, isoY) scaled by ortho
  // Column 1: iso y-basis (-isoX, isoY) scaled by ortho
  // prettier-ignore
  return new Float32Array([
     sx * isoX,       isoY * sy,  0, 0,
    -sx * isoX,       isoY * sy,  0, 0,
     0,               0,          1, 0,
     tx,              ty,         0, 1,
  ]);
}

/**
 * Convert screen pixel coordinates to world coordinates.
 *
 * Inverts the isometric projection:
 *   world_x = cam.x + 0.5·dx + dy
 *   world_y = cam.y − 0.5·dx + dy
 *
 * where dx/dy are the screen offset from centre in world units.
 */
export function screenToWorld(
  cam: Camera,
  canvasW: number,
  canvasH: number,
  screenX: number,
  screenY: number,
): { wx: number; wy: number } {
  // Screen offset from centre, in world-unit scale.
  const dx = (screenX - canvasW / 2) / cam.zoom;
  const dy = -(screenY - canvasH / 2) / cam.zoom; // Y flipped

  // Invert the isometric transform.
  const isoX = CAMERA_CONFIG.isoXFactor;
  const isoY = CAMERA_CONFIG.isoYFactor;
  const wx = cam.x + (1 / (2 * isoX)) * dx + (1 / (2 * isoY)) * dy;
  const wy = cam.y - (1 / (2 * isoX)) * dx + (1 / (2 * isoY)) * dy;
  return { wx, wy };
}

// ---------------------------------------------------------------------------
// Input helpers — attach once, mutate the camera each frame
// ---------------------------------------------------------------------------

/** Accumulated input deltas, consumed each frame. */
export interface CameraInput {
  /** Scroll delta (positive = zoom in). */
  scrollDelta: number;
  /** Whether the user is currently dragging with middle mouse. */
  dragging: boolean;
  /** Pointer movement in pixels since last frame. */
  dragDx: number;
  dragDy: number;
  /** Currently held arrow / WASD keys. */
  keys: Set<string>;
}

export function createCameraInput(): CameraInput {
  return {
    scrollDelta: 0,
    dragging: false,
    dragDx: 0,
    dragDy: 0,
    keys: new Set(),
  };
}

/** Attach DOM listeners to populate a CameraInput struct. */
export function attachCameraListeners(
  canvas: HTMLCanvasElement,
  input: CameraInput,
): void {
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      input.scrollDelta += -Math.sign(e.deltaY);
    },
    { passive: false },
  );

  canvas.addEventListener("pointerdown", (e) => {
    // Middle mouse (button 1) or left mouse + alt
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      input.dragging = true;
      canvas.setPointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (input.dragging) {
      input.dragDx += e.movementX;
      input.dragDy += e.movementY;
    }
  });

  canvas.addEventListener("pointerup", (e) => {
    if (e.button === 1 || e.button === 0) {
      input.dragging = false;
      canvas.releasePointerCapture(e.pointerId);
    }
  });

  window.addEventListener("keydown", (e) => input.keys.add(e.key));
  window.addEventListener("keyup", (e) => input.keys.delete(e.key));
}

/**
 * Convert a screen-space direction (dx, dy) to a world-space displacement.
 * Inverts the isometric axes so panning feels screen-intuitive.
 */
function screenDirToWorld(dx: number, dy: number): { wx: number; wy: number } {
  const isoX = CAMERA_CONFIG.isoXFactor;
  const isoY = CAMERA_CONFIG.isoYFactor;
  return {
    wx: (1 / (2 * isoX)) * dx + (1 / (2 * isoY)) * dy,
    wy: -(1 / (2 * isoX)) * dx + (1 / (2 * isoY)) * dy,
  };
}

/** Apply accumulated input to the camera. Call once per frame. */
export function updateCamera(
  cam: Camera,
  input: CameraInput,
  dt: number,
): void {
  // --- Zoom (scroll wheel) ------------------------------------------------
  while (input.scrollDelta > 0) {
    cam.zoom = Math.min(CAMERA_CONFIG.maxZoom, cam.zoom * CAMERA_CONFIG.zoomSpeed);
    input.scrollDelta--;
  }
  while (input.scrollDelta < 0) {
    cam.zoom = Math.max(CAMERA_CONFIG.minZoom, cam.zoom / CAMERA_CONFIG.zoomSpeed);
    input.scrollDelta++;
  }

  // --- Pan (mouse drag) ---------------------------------------------------
  if (input.dragDx !== 0 || input.dragDy !== 0) {
    // Convert screen pixel movement to world displacement.
    const sdx = input.dragDx / cam.zoom;
    const sdy = -input.dragDy / cam.zoom; // screen Y flipped
    const d = screenDirToWorld(sdx, sdy);
    cam.x -= d.wx;
    cam.y -= d.wy;
    input.dragDx = 0;
    input.dragDy = 0;
  }

  // --- Pan (keyboard) -----------------------------------------------------
  const speed = CAMERA_CONFIG.panKeySpeed * (CAMERA_CONFIG.defaultZoom / cam.zoom) * dt;
  let kdx = 0;
  let kdy = 0;
  if (input.keys.has("ArrowLeft") || input.keys.has("a")) kdx -= 1;
  if (input.keys.has("ArrowRight") || input.keys.has("d")) kdx += 1;
  if (input.keys.has("ArrowUp") || input.keys.has("w")) kdy += 1;
  if (input.keys.has("ArrowDown") || input.keys.has("s")) kdy -= 1;
  if (kdx !== 0 || kdy !== 0) {
    const d = screenDirToWorld(kdx, kdy);
    cam.x += d.wx * speed;
    cam.y += d.wy * speed;
  }
}
