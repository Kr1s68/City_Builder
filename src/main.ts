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
import { PlaceholderEntity, HouseEntity, MoveableEntity, WallEntity, BuildingEntity } from "./game/entities";
import { getPathCells } from "./game/pathNetwork";
import { createEconomyState, canAfford, spendResources, RESOURCE_TYPES } from "./game/resources";
import type { EconomyState } from "./game/resources";
import { getBuildingDef } from "./game/buildings";
import type { BuildingType } from "./game/buildings";
import { simulationTick } from "./game/simulation";

async function main() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const errorDiv = document.getElementById("error") as HTMLDivElement;
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

    // --- Economy state -----------------------------------------------------
    const economy = createEconomyState();

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

    // --- HUD resource display ---------------------------------------------
    const hudDiv = document.getElementById("hud") as HTMLDivElement;

    function updateHUD(eco: EconomyState) {
      hudDiv.textContent =
        `Gold: ${Math.floor(eco.resources.gold)}/${eco.capacity.gold}  |  ` +
        `Wood: ${Math.floor(eco.resources.wood)}/${eco.capacity.wood}  |  ` +
        `Stone: ${Math.floor(eco.resources.stone)}/${eco.capacity.stone}  |  ` +
        `Food: ${Math.floor(eco.resources.food)}/${eco.capacity.food}`;
    }
    updateHUD(economy);

    // --- Placement mode ---------------------------------------------------
    type PlacingMode = "none" | BuildingType | "placeholder";
    let placingMode: PlacingMode = "none";
    let mouseScreenX = 0;
    let mouseScreenY = 0;

    /** All toolbar building buttons. */
    const buildingButtons = document.querySelectorAll<HTMLButtonElement>("[data-building]");

    function setPlacingMode(mode: PlacingMode) {
      placingMode = placingMode === mode ? "none" : mode;
      // Update button active states
      buildingButtons.forEach((btn) => {
        const bType = btn.dataset.building as string;
        btn.classList.toggle("active", placingMode === bType);
      });
    }

    buildingButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const bType = btn.dataset.building as PlacingMode;
        setPlacingMode(bType);
      });
    });

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

      // Handle legacy placeholder mode
      if (placingMode === "placeholder") {
        const entity = new PlaceholderEntity(col, row);
        placeEntity(entity);
        return;
      }

      // Look up building definition and check cost
      const def = getBuildingDef(placingMode as BuildingType);
      if (!canAfford(economy, def.cost)) return;

      // Create the appropriate entity
      let entity;
      if (placingMode === "house") {
        entity = new HouseEntity(col, row, def.buildTime);
      } else if (placingMode === "wall") {
        entity = new WallEntity(col, row, { maxHealth: def.maxHealth });
      } else {
        entity = new BuildingEntity(col, row, placingMode as BuildingType, def.width, def.height, def.maxHealth);
      }

      if (placeEntity(entity)) {
        spendResources(economy, def.cost);
        updateHUD(economy);
      }
    });

    // --- Frame loop -------------------------------------------------------
    let lastTime = 0;
    const MOVE_INTERVAL = 0.5; // seconds between moveable entity steps
    let moveTimer = 0;
    const ECONOMY_INTERVAL = 5.0; // seconds between economy ticks
    let economyTimer = 0;

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

      // Economy tick at fixed interval
      economyTimer += dt;
      if (economyTimer >= ECONOMY_INTERVAL) {
        economyTimer -= ECONOMY_INTERVAL;
        simulationTick(economy);
        updateHUD(economy);
      }

      const vp = getViewProjectionMatrix(
        camera,
        renderer.canvas.width,
        renderer.canvas.height,
      );

      // Build preview when in placing mode
      let previewCells: { col: number; row: number }[] | undefined;
      let previewTextured: { col: number; row: number; width: number; height: number; type: string }[] | undefined;
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

        if (placingMode === "placeholder") {
          previewCells = [];
          for (let dc = 0; dc < 2; dc++) {
            for (let dr = 0; dr < 2; dr++) {
              previewCells.push({ col: col + dc, row: row + dr });
            }
          }
        } else {
          // All building types now use textured preview via the atlas
          const def = getBuildingDef(placingMode as BuildingType);
          previewTextured = [{ col, row, width: def.width, height: def.height, type: placingMode as string }];
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
