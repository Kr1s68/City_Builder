/** Path network — connects buildings with A*-generated roads.
 *
 *  Each building connects to its 3 closest neighbours (by Manhattan distance).
 *  On placement the network is updated incrementally — only the new building's
 *  connections are computed. On removal the affected segments are cleaned up
 *  and orphaned neighbours are reconnected.
 *
 *  Path cells are NOT marked as occupied — buildings can be placed on them.
 */

import { findPath, type PathCell } from "./pathfinder";
import {
  getAllEntities,
  getEntityAt,
  getEntityById,
  getMoveableEntities,
  GRID_COLS,
  GRID_ROWS,
} from "./grid";
import type { PlaceableEntity } from "./entities";

/** Returns true if the entity is a wall (walls don't participate in the road network). */
function isWall(entity: PlaceableEntity): boolean {
  return "defence" in entity;
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** All cells that belong to the path network. Key = "col,row". */
const pathCellSet = new Set<string>();

/** Individual path segments between building pairs. */
interface Segment {
  fromId: number;
  toId: number;
  cells: PathCell[];
}
const segments: Segment[] = [];

/** Maximum neighbours each building connects to. */
const MAX_NEIGHBOURS = 1;

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

function manhattan(a: PathCell, b: PathCell): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
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
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the cell is blocked for pathfinding (occupied by a building). */
function isCellBlocked(col: number, row: number): boolean {
  return getEntityAt(col, row) !== undefined;
}

/** Rebuild pathCellSet from all stored segments. */
function rebuildCellSet(): void {
  pathCellSet.clear();
  for (const seg of segments) {
    for (const cell of seg.cells) {
      pathCellSet.add(cellKey(cell.col, cell.row));
    }
  }
}

/** Check whether a segment already connects two building IDs (in either direction). */
function segmentExists(idA: number, idB: number): boolean {
  return segments.some(
    (s) =>
      (s.fromId === idA && s.toId === idB) ||
      (s.fromId === idB && s.toId === idA),
  );
}

/** Count how many segments involve a given building ID. */
function connectionCount(entityId: number): number {
  return segments.filter((s) => s.fromId === entityId || s.toId === entityId)
    .length;
}

/** Notify all moveable entities to re-plan their routes. */
function clearMoveableNavigation(): void {
  for (const m of getMoveableEntities()) {
    m.clearPath();
  }
}

/** Search radius (in cells) when looking for an existing nearby path to connect to. */
const NEARBY_RADIUS = 5;

/**
 * Find the nearest existing path cell within NEARBY_RADIUS of a position.
 * Returns null if no reachable path cell is close enough.
 */
function findNearbyPathCell(col: number, row: number): PathCell | null {
  for (let r = 0; r <= NEARBY_RADIUS; r++) {
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue; // ring perimeter only
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
        if (pathCellSet.has(cellKey(nc, nr)) && !isCellBlocked(nc, nr)) {
          return { col: nc, row: nr };
        }
      }
    }
  }
  return null;
}

/**
 * Find the building ID that owns a segment containing the given path cell.
 * Returns the segment's fromId, or -1 if the cell isn't in any segment.
 */
function findSegmentOwner(col: number, row: number): number {
  const key = cellKey(col, row);
  for (const seg of segments) {
    for (const cell of seg.cells) {
      if (cellKey(cell.col, cell.row) === key) return seg.fromId;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Incremental network updates
// ---------------------------------------------------------------------------

/**
 * Add paths from a newly placed building to its closest neighbours.
 * If the building's door is already near an existing path, creates a short
 * bridge segment instead of running long-distance A* to building doors.
 */
export function addPathsForEntity(entity: PlaceableEntity): void {
  // Walls are defensive structures — they don't connect to the road network.
  if (isWall(entity)) return;

  const door = getDoorCell(entity);
  if (!door) return;

  // --- Check for a nearby existing path first ---
  // If the door is already close to the network, create a short bridge
  // to connect to it instead of running expensive A* to distant doors.
  const nearbyCell = findNearbyPathCell(door.col, door.row);
  if (nearbyCell) {
    const ownerId = findSegmentOwner(nearbyCell.col, nearbyCell.row);
    // Only bridge if we're not already connected to that segment's owner.
    if (ownerId !== -1 && !segmentExists(entity.id, ownerId)) {
      const bridge = findPath(
        door.col,
        door.row,
        nearbyCell.col,
        nearbyCell.row,
        GRID_COLS,
        GRID_ROWS,
        isCellBlocked,
      );
      if (bridge.length > 0) {
        segments.push({ fromId: entity.id, toId: ownerId, cells: bridge });
        for (const cell of bridge) {
          pathCellSet.add(cellKey(cell.col, cell.row));
        }
        clearMoveableNavigation();
        return; // connected to existing network — done
      }
    }
  }

  // --- No nearby path — connect to closest building doors ---
  const others: { entity: PlaceableEntity; door: PathCell }[] = [];
  for (const e of getAllEntities()) {
    if (e.id === entity.id) continue;
    if (isWall(e)) continue; // walls are not path targets
    const d = getDoorCell(e);
    if (d) others.push({ entity: e, door: d });
  }

  if (others.length === 0) return;

  // Sort by Manhattan distance and take the closest MAX_NEIGHBOURS.
  others.sort((a, b) => manhattan(door, a.door) - manhattan(door, b.door));
  const nearest = others.slice(0, MAX_NEIGHBOURS);

  for (const target of nearest) {
    // Skip if this pair is already connected.
    if (segmentExists(entity.id, target.entity.id)) continue;

    const path = findPath(
      door.col,
      door.row,
      target.door.col,
      target.door.row,
      GRID_COLS,
      GRID_ROWS,
      isCellBlocked,
    );

    if (path.length === 0) continue;

    segments.push({ fromId: entity.id, toId: target.entity.id, cells: path });
    for (const cell of path) {
      pathCellSet.add(cellKey(cell.col, cell.row));
    }
  }

  clearMoveableNavigation();
}

/**
 * Remove all paths involving a building and reconnect any orphaned neighbours.
 */
export function removePathsForEntity(entityId: number): void {
  // Collect IDs of buildings that were connected to the removed one.
  const orphanIds = new Set<number>();
  for (const seg of segments) {
    if (seg.fromId === entityId) orphanIds.add(seg.toId);
    else if (seg.toId === entityId) orphanIds.add(seg.fromId);
  }

  // Remove all segments involving the removed building.
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].fromId === entityId || segments[i].toId === entityId) {
      segments.splice(i, 1);
    }
  }

  rebuildCellSet();

  // Reconnect orphans that now have fewer than MAX_NEIGHBOURS connections.
  for (const oid of orphanIds) {
    if (connectionCount(oid) >= MAX_NEIGHBOURS) continue;
    const orphan = getEntityById(oid);
    if (orphan) addPathsForEntity(orphan);
  }

  clearMoveableNavigation();
}

/**
 * Full rebuild using the k-nearest strategy.
 * O(3N) A* calls — linear, not quadratic. Used as a fallback.
 */
export function regeneratePaths(): void {
  segments.length = 0;
  pathCellSet.clear();

  const entities = getAllEntities();
  if (entities.length < 2) return;

  for (const entity of entities) {
    addPathsForEntity(entity);
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
    if (isWall(e)) continue; // walls have no doors
    const door = getDoorCell(e);
    if (door) doors.push(door);
  }
  return doors;
}
