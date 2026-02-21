/** Grid configuration, line-geometry generation, and entity tracking.
 *
 *  The grid is the spatial foundation of the city builder.
 *  All buildings and sprites snap to cells on this grid.
 *  This module is pure data — no GPU or rendering code.
 */

import { PlaceableEntity, MoveableEntity } from "./entities";

/** Number of columns (cells along X). */
export const GRID_COLS = 128;

/** Number of rows (cells along Y). */
export const GRID_ROWS = 128;

/** Size of one cell in world units. */
export const CELL_SIZE = 1.0;

/** Total world-space width of the grid. */
export const GRID_WIDTH = GRID_COLS * CELL_SIZE;

/** Total world-space height of the grid. */
export const GRID_HEIGHT = GRID_ROWS * CELL_SIZE;

// ---------------------------------------------------------------------------
// Grid entity tracking
// ---------------------------------------------------------------------------

/** Lookup from entity ID → entity. */
const entitiesById = new Map<number, PlaceableEntity>();

/** 2D sparse lookup: cell (col, row) → entity occupying it (or undefined). */
const cellOccupant = new Map<string, PlaceableEntity>();

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

/** Place an entity on the grid. Returns false if any cell in its footprint is occupied or out of bounds. */
export function placeEntity(entity: PlaceableEntity): boolean {
  // Bounds check for the full footprint
  if (
    entity.col < 0 || entity.col + entity.width > GRID_COLS ||
    entity.row < 0 || entity.row + entity.height > GRID_ROWS
  ) {
    return false;
  }

  // Collision check — every cell must be free
  for (let dc = 0; dc < entity.width; dc++) {
    for (let dr = 0; dr < entity.height; dr++) {
      if (cellOccupant.has(cellKey(entity.col + dc, entity.row + dr))) {
        return false;
      }
    }
  }

  // Commit — mark all cells
  entitiesById.set(entity.id, entity);
  for (let dc = 0; dc < entity.width; dc++) {
    for (let dr = 0; dr < entity.height; dr++) {
      cellOccupant.set(cellKey(entity.col + dc, entity.row + dr), entity);
    }
  }
  return true;
}

/** Remove an entity from the grid by its ID. Returns the removed entity, or undefined. */
export function removeEntity(id: number): PlaceableEntity | undefined {
  const entity = entitiesById.get(id);
  if (!entity) return undefined;

  entitiesById.delete(id);
  for (let dc = 0; dc < entity.width; dc++) {
    for (let dr = 0; dr < entity.height; dr++) {
      cellOccupant.delete(cellKey(entity.col + dc, entity.row + dr));
    }
  }
  return entity;
}

/** Get the entity at a given cell, if any. */
export function getEntityAt(col: number, row: number): PlaceableEntity | undefined {
  return cellOccupant.get(cellKey(col, row));
}

/** Get an entity by its ID. */
export function getEntityById(id: number): PlaceableEntity | undefined {
  return entitiesById.get(id);
}

/** Return all placed entities. */
export function getAllEntities(): PlaceableEntity[] {
  return Array.from(entitiesById.values());
}

/** Return every occupied cell across all placed entities. */
export function getOccupiedCells(): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = [];
  for (const entity of entitiesById.values()) {
    for (let dc = 0; dc < entity.width; dc++) {
      for (let dr = 0; dr < entity.height; dr++) {
        cells.push({ col: entity.col + dc, row: entity.row + dr });
      }
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Moveable entity tracking
// ---------------------------------------------------------------------------

const moveableEntities: MoveableEntity[] = [];

/** Register a moveable entity on the grid. */
export function addMoveableEntity(entity: MoveableEntity): void {
  moveableEntities.push(entity);
}

/** Return all moveable entities. */
export function getMoveableEntities(): MoveableEntity[] {
  return moveableEntities;
}

/** Return cell positions of all moveable entities (for rendering). */
export function getMoveableCells(): { col: number; row: number }[] {
  return moveableEntities.map((e) => ({ col: e.col, row: e.row }));
}

/** Advance every moveable entity by one random step. */
export function tickMoveableEntities(): void {
  for (const entity of moveableEntities) {
    entity.step(GRID_COLS, GRID_ROWS);
  }
}

/**
 * Generate vertex positions for every grid line.
 *
 * Returns a Float32Array of (x, y) pairs laid out for `line-list` topology:
 * two vertices per line segment.
 *
 *  - (GRID_COLS + 1) vertical lines
 *  - (GRID_ROWS + 1) horizontal lines
 *  - 2 vertices per line, 2 floats per vertex
 */
export function generateGridLines(): Float32Array {
  const verticalCount = GRID_COLS + 1;
  const horizontalCount = GRID_ROWS + 1;
  const totalLines = verticalCount + horizontalCount;
  const floatsPerLine = 2 * 2; // 2 vertices × 2 floats (x, y)
  const data = new Float32Array(totalLines * floatsPerLine);

  let offset = 0;

  // Vertical lines (constant x, y goes from 0 → GRID_HEIGHT)
  for (let col = 0; col <= GRID_COLS; col++) {
    const x = col * CELL_SIZE;
    data[offset++] = x;
    data[offset++] = 0;
    data[offset++] = x;
    data[offset++] = GRID_HEIGHT;
  }

  // Horizontal lines (constant y, x goes from 0 → GRID_WIDTH)
  for (let row = 0; row <= GRID_ROWS; row++) {
    const y = row * CELL_SIZE;
    data[offset++] = 0;
    data[offset++] = y;
    data[offset++] = GRID_WIDTH;
    data[offset++] = y;
  }

  return data;
}
