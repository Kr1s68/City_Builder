import { initRenderer } from "./engine/renderer/index";
import {
  createCamera,
  createCameraInput,
  attachCameraListeners,
  updateCamera,
  getViewProjectionMatrix,
  screenToWorld,
} from "./engine/camera";
import {
  generateGridLines,
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
  placeEntity,
  getOccupiedCells,
  getTexturedEntities,
  addMoveableEntity,
  getMoveableCells,
  tickMoveableEntities,
} from "./game/grid";
import { PlaceholderEntity, HouseEntity, MoveableEntity } from "./game/entities";
import { getPathCells } from "./game/pathNetwork";

async function main() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const errorDiv = document.getElementById("error") as HTMLDivElement;
  const newEntityBtn = document.getElementById("btn-new-entity") as HTMLButtonElement;
  const newHouseBtn = document.getElementById("btn-new-house") as HTMLButtonElement;
  const toggleGridBtn = document.getElementById("btn-toggle-grid") as HTMLButtonElement;

  if (!navigator.gpu) {
    errorDiv.style.display = "flex";
    errorDiv.textContent =
      "WebGPU is not supported in this browser. Try Chrome 113+ or Edge 113+.";
    return;
  }

  try {
    // --- Grid geometry & renderer ------------------------------------------
    const gridLines = generateGridLines();
    const renderer = await initRenderer(canvas, gridLines);

    // --- Camera (centred on the grid) -------------------------------------
    const camera = createCamera(GRID_WIDTH / 2, GRID_HEIGHT / 2);
    const camInput = createCameraInput();
    attachCameraListeners(canvas, camInput);

    // --- Spawn a few moveable entities ------------------------------------
    for (let i = 0; i < 5; i++) {
      const col = Math.floor(Math.random() * GRID_COLS);
      const row = Math.floor(Math.random() * GRID_ROWS);
      addMoveableEntity(new MoveableEntity(col, row));
    }

    // --- Grid toggle ------------------------------------------------------
    toggleGridBtn.addEventListener("click", () => {
      renderer.showGrid = !renderer.showGrid;
      toggleGridBtn.classList.toggle("active", renderer.showGrid);
    });

    // --- Placement mode ---------------------------------------------------
    type PlacingMode = "none" | "placeholder" | "house";
    let placingMode: PlacingMode = "none";
    let mouseScreenX = 0;
    let mouseScreenY = 0;

    function setPlacingMode(mode: PlacingMode) {
      placingMode = placingMode === mode ? "none" : mode;
      newEntityBtn.classList.toggle("active", placingMode === "placeholder");
      newHouseBtn.classList.toggle("active", placingMode === "house");
    }

    newEntityBtn.addEventListener("click", () => setPlacingMode("placeholder"));
    newHouseBtn.addEventListener("click", () => setPlacingMode("house"));

    canvas.addEventListener("pointermove", (e) => {
      const dpr = window.devicePixelRatio || 1;
      mouseScreenX = e.offsetX * dpr;
      mouseScreenY = e.offsetY * dpr;
    });

    canvas.addEventListener("click", (e) => {
      if (placingMode === "none") return;
      if (e.altKey) return;

      const dpr = window.devicePixelRatio || 1;
      const screenX = e.offsetX * dpr;
      const screenY = e.offsetY * dpr;

      const { wx, wy } = screenToWorld(
        camera,
        canvas.width,
        canvas.height,
        screenX,
        screenY,
      );

      const col = Math.floor(wx / CELL_SIZE);
      const row = Math.floor(wy / CELL_SIZE);

      const entity =
        placingMode === "house"
          ? new HouseEntity(col, row)
          : new PlaceholderEntity(col, row);
      placeEntity(entity);
    });

    // --- Frame loop -------------------------------------------------------
    let lastTime = 0;
    const MOVE_INTERVAL = 0.5; // seconds between moveable entity steps
    let moveTimer = 0;

    function loop(time: number) {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      updateCamera(camera, camInput, dt);

      // Tick moveable entities at fixed interval
      moveTimer += dt;
      if (moveTimer >= MOVE_INTERVAL) {
        moveTimer -= MOVE_INTERVAL;
        tickMoveableEntities();
      }

      const vp = getViewProjectionMatrix(
        camera,
        renderer.canvas.width,
        renderer.canvas.height,
      );

      // Build preview when in placing mode
      let previewCells: { col: number; row: number }[] | undefined;
      let previewTextured: { col: number; row: number; width: number; height: number }[] | undefined;
      if (placingMode !== "none") {
        const { wx, wy } = screenToWorld(
          camera,
          canvas.width,
          canvas.height,
          mouseScreenX,
          mouseScreenY,
        );
        const col = Math.floor(wx / CELL_SIZE);
        const row = Math.floor(wy / CELL_SIZE);
        if (placingMode === "house") {
          previewTextured = [{ col, row, width: 2, height: 2 }];
        } else {
          previewCells = [];
          for (let dc = 0; dc < 2; dc++) {
            for (let dr = 0; dr < 2; dr++) {
              previewCells.push({ col: col + dc, row: row + dr });
            }
          }
        }
      }

      renderer.frame(vp, getOccupiedCells(), previewCells, getMoveableCells(), getPathCells(), getTexturedEntities(), previewTextured);

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  } catch (err) {
    errorDiv.style.display = "flex";
    errorDiv.textContent = `Failed to initialise WebGPU: ${err}`;
    console.error(err);
  }
}

main();
