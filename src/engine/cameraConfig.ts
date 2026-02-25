/**
 * Camera & isometric projection configuration.
 *
 * Every tunable parameter that affects the camera, zoom, panning,
 * isometric skew, and billboard sprite rendering lives here.
 * Adjust these values to change the look and feel of the game view.
 */

export interface CameraConfig {
  // --- Zoom -----------------------------------------------------------------
  /** Minimum zoom level (most zoomed out). */
  minZoom: number;
  /** Maximum zoom level (most zoomed in). */
  maxZoom: number;
  /** Default zoom level at startup. */
  defaultZoom: number;
  /** Multiplicative zoom factor per scroll wheel tick. */
  zoomSpeed: number;

  // --- Panning --------------------------------------------------------------
  /** Base keyboard pan speed in world units per second at default zoom. */
  panKeySpeed: number;

  // --- Isometric projection -------------------------------------------------
  /**
   * X-axis scale factor for the isometric transform.
   *
   * Controls how much the world X axis contributes to screen X.
   * Default 1.0 gives a standard isometric diamond.
   * - Increase (>1) to stretch the grid horizontally.
   * - Decrease (<1) to compress the grid horizontally.
   */
  isoXFactor: number;

  /**
   * Y-axis compression factor for the isometric transform.
   *
   * Controls vertical squash of the isometric view.
   * Default 0.5 gives the classic isometric 2:1 ratio.
   * - 0.5  = standard isometric (30° viewing angle).
   * - 0.25 = flatter, more top-down feel.
   * - 0.75 = steeper, more side-on perspective.
   * - 1.0  = no compression (45° perfect diagonal).
   */
  isoYFactor: number;

  // --- Billboard sprites ----------------------------------------------------
  /**
   * Horizontal padding for billboard sprites in iso-space,
   * expressed as a multiple of CELL_SIZE.
   *
   * Extends the sprite quad left and right beyond the footprint diamond.
   * Default 0.5 adds half a cell of padding on each side.
   * - Increase if sprites are clipped at the sides.
   * - Decrease for tighter-fitting billboards.
   */
  billboardPadX: number;

  /**
   * Vertical padding above the footprint diamond for billboard sprites,
   * expressed as a multiple of CELL_SIZE.
   *
   * Controls how far above the footprint the sprite extends.
   * Default 1.5 gives room for a building's roof/height.
   * - Increase for taller buildings or to prevent top clipping.
   * - Decrease for flatter buildings (farms, roads).
   */
  billboardPadUp: number;
}

/**
 * The active camera configuration. Import and modify these values
 * to change the camera behaviour at runtime or at startup.
 */
export const CAMERA_CONFIG: CameraConfig = {
  // Zoom
  minZoom: 8,
  maxZoom: 128,
  defaultZoom: 40,
  zoomSpeed: 1.1,

  // Panning
  panKeySpeed: 8,

  // Isometric projection
  isoXFactor: 0.9,
  isoYFactor: 0.2,

  // Billboard sprites
  billboardPadX: 0.5,
  billboardPadUp: 1.5,
};
