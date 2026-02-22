/** Path network — connects buildings with A*-generated roads.
 *
 *  Uses a Minimum Spanning Tree (Prim's algorithm) to decide which
 *  buildings to connect, then runs A* for each edge.
 *  Path cells are NOT marked as occupied — buildings can be placed on them.
 */

import { findPath, type PathCell } from "./pathfinder";
import {
  getAllEntities,
  getEntityAt,
  getMoveableEntities,
  GRID_COLS,
  GRID_ROWS,
} from "./grid";
import type { PlaceableEntity } from "./entities";

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** All cells that belong to the path network. Key = "col,row". */
const pathCellSet = new Set<string>();

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

// ---------------------------------------------------------------------------
// Door cell selection
// ---------------------------------------------------------------------------

/**
 * Pick a "door" cell for a building — one empty cell adjacent to its footprint.
 * Tries south, east, north, west in order. Returns null if completely walled in.
 */
function getDoorCell(entity: PlaceableEntity): PathCell | null {
  const midCol = entity.col + Math.floor(entity.width / 2);
  const midRow = entity.row + Math.floor(entity.height / 2);

  // South
  const sRow = entity.row + entity.height;
  if (sRow < GRID_ROWS && !getEntityAt(midCol, sRow)) {
    return { col: midCol, row: sRow };
  }
  // East
  const eCol = entity.col + entity.width;
  if (eCol < GRID_COLS && !getEntityAt(eCol, midRow)) {
    return { col: eCol, row: midRow };
  }
  // North
  const nRow = entity.row - 1;
  if (nRow >= 0 && !getEntityAt(midCol, nRow)) {
    return { col: midCol, row: nRow };
  }
  // West
  const wCol = entity.col - 1;
  if (wCol >= 0 && !getEntityAt(wCol, midRow)) {
    return { col: wCol, row: midRow };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Network generation
// ---------------------------------------------------------------------------

/** Returns true if the cell is blocked for pathfinding (occupied by a building). */
function isCellBlocked(col: number, row: number): boolean {
  return getEntityAt(col, row) !== undefined;
}

/**
 * Regenerate the entire path network.
 * Called whenever buildings are placed or removed.
 */
export function regeneratePaths(): void {
  pathCellSet.clear();

  const entities = getAllEntities();
  if (entities.length < 2) return;

  // Collect door cells for each building.
  const doors: { entity: PlaceableEntity; door: PathCell }[] = [];
  for (const e of entities) {
    const door = getDoorCell(e);
    if (door) doors.push({ entity: e, door });
  }

  if (doors.length < 2) return;

  // --- Prim's MST ----------------------------------------------------------
  // Nodes = indices into `doors`. Edge weight = A* path length.
  const n = doors.length;
  const inMST = new Array<boolean>(n).fill(false);
  inMST[0] = true;
  let mstCount = 1;

  while (mstCount < n) {
    let bestLen = Infinity;
    let bestPath: PathCell[] = [];
    let bestJ = -1;

    for (let i = 0; i < n; i++) {
      if (!inMST[i]) continue;
      for (let j = 0; j < n; j++) {
        if (inMST[j]) continue;
        const path = findPath(
          doors[i].door.col,
          doors[i].door.row,
          doors[j].door.col,
          doors[j].door.row,
          GRID_COLS,
          GRID_ROWS,
          isCellBlocked,
        );
        if (path.length > 0 && path.length < bestLen) {
          bestLen = path.length;
          bestPath = path;
          bestJ = j;
        }
      }
    }

    if (bestJ === -1) break; // remaining buildings are unreachable
    inMST[bestJ] = true;
    mstCount++;

    for (const cell of bestPath) {
      pathCellSet.add(cellKey(cell.col, cell.row));
    }
  }

  // Clear navigation on all moveable entities so they re-plan.
  for (const m of getMoveableEntities()) {
    m.clearPath();
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Return all path cells for rendering (excludes cells under buildings). */
export function getPathCells(): PathCell[] {
  const cells: PathCell[] = [];
  for (const key of pathCellSet) {
    const [c, r] = key.split(",");
    const col = Number(c);
    const row = Number(r);
    if (!getEntityAt(col, row)) {
      cells.push({ col, row });
    }
  }
  return cells;
}

/** Check whether a cell belongs to the path network. */
export function isPathCell(col: number, row: number): boolean {
  return pathCellSet.has(cellKey(col, row));
}

/**
 * Find a walkable route between two points, constrained to path cells.
 * Used by moveable entities to navigate the road network.
 */
export function findNavigationPath(
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
): PathCell[] {
  return findPath(
    fromCol,
    fromRow,
    toCol,
    toRow,
    GRID_COLS,
    GRID_ROWS,
    (c, r) => !isPathCell(c, r) && !(c === fromCol && r === fromRow),
  );
}

/** Return all door cells of placed buildings (for moveable destination picking). */
export function getBuildingDoors(): PathCell[] {
  const doors: PathCell[] = [];
  for (const e of getAllEntities()) {
    const door = getDoorCell(e);
    if (door) doors.push(door);
  }
  return doors;
}
