/** 2D orthographic camera with pan and zoom.
 *
 *  The camera sits above the world looking straight down.
 *  It converts world coordinates to clip space via an orthographic
 *  view-projection matrix that the GPU shader consumes.
 */

export interface Camera {
  /** World-space X of the view centre. */
  x: number;
  /** World-space Y of the view centre. */
  y: number;
  /** Pixels per world unit. Higher = more zoomed in. */
  zoom: number;
}

const MIN_ZOOM = 8;
const MAX_ZOOM = 128;
const ZOOM_SPEED = 1.1; // multiplicative per wheel tick
const PAN_KEY_SPEED = 8; // world units per second

/** Create a camera centred on (cx, cy). */
export function createCamera(cx: number, cy: number, zoom = 40): Camera {
  return { x: cx, y: cy, zoom };
}

/**
 * Build a column-major 4×4 orthographic view-projection matrix.
 *
 * Maps world coordinates to clip space [-1, 1] based on the camera
 * position, zoom level, and canvas pixel dimensions.
 */
export function getViewProjectionMatrix(
  cam: Camera,
  canvasW: number,
  canvasH: number,
): Float32Array {
  // Half-extents in world units visible on screen.
  const halfW = canvasW / (2 * cam.zoom);
  const halfH = canvasH / (2 * cam.zoom);

  // Orthographic: maps [left..right, bottom..top] → [-1..1]
  // Scale then translate (column-major).
  const sx = 1 / halfW;
  const sy = 1 / halfH;
  const tx = -cam.x * sx;
  const ty = -cam.y * sy;

  // prettier-ignore
  return new Float32Array([
    sx,  0,   0, 0,
    0,   sy,  0, 0,
    0,   0,   1, 0,
    tx,  ty,  0, 1,
  ]);
}

/** Convert screen pixel coordinates to world coordinates. */
export function screenToWorld(
  cam: Camera,
  canvasW: number,
  canvasH: number,
  screenX: number,
  screenY: number,
): { wx: number; wy: number } {
  // Screen centre is the camera position. Offset from centre, scaled by zoom.
  const wx = cam.x + (screenX - canvasW / 2) / cam.zoom;
  // Screen Y is top-down, world Y is bottom-up.
  const wy = cam.y - (screenY - canvasH / 2) / cam.zoom;
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
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    input.scrollDelta += -Math.sign(e.deltaY);
  }, { passive: false });

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

/** Apply accumulated input to the camera. Call once per frame. */
export function updateCamera(
  cam: Camera,
  input: CameraInput,
  dt: number,
): void {
  // --- Zoom (scroll wheel) ------------------------------------------------
  while (input.scrollDelta > 0) {
    cam.zoom = Math.min(MAX_ZOOM, cam.zoom * ZOOM_SPEED);
    input.scrollDelta--;
  }
  while (input.scrollDelta < 0) {
    cam.zoom = Math.max(MIN_ZOOM, cam.zoom / ZOOM_SPEED);
    input.scrollDelta++;
  }

  // --- Pan (mouse drag) ---------------------------------------------------
  if (input.dragDx !== 0 || input.dragDy !== 0) {
    cam.x -= input.dragDx / cam.zoom;
    cam.y += input.dragDy / cam.zoom; // screen Y is flipped vs world Y
    input.dragDx = 0;
    input.dragDy = 0;
  }

  // --- Pan (keyboard) -----------------------------------------------------
  const speed = PAN_KEY_SPEED * (40 / cam.zoom) * dt;
  if (input.keys.has("ArrowLeft") || input.keys.has("a")) cam.x -= speed;
  if (input.keys.has("ArrowRight") || input.keys.has("d")) cam.x += speed;
  if (input.keys.has("ArrowUp") || input.keys.has("w")) cam.y += speed;
  if (input.keys.has("ArrowDown") || input.keys.has("s")) cam.y -= speed;
}
