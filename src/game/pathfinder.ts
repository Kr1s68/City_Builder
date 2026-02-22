/** A* pathfinding on the grid.
 *
 *  Pure utility — no game state, no side effects.
 *  Uses 4-directional movement for cleaner-looking roads.
 */

export interface PathCell {
  col: number;
  row: number;
}

/** 4-directional neighbours (no diagonals). */
const DIRS = [
  { dc: 0, dr: -1 },
  { dc: 1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 0 },
];

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

function manhattan(c1: number, r1: number, c2: number, r2: number): number {
  return Math.abs(c1 - c2) + Math.abs(r1 - r2);
}

interface Node {
  col: number;
  row: number;
  g: number;
  f: number;
  parentKey: string | null;
}

/**
 * Find the shortest path between two cells using A*.
 *
 * @param startCol  Start column.
 * @param startRow  Start row.
 * @param endCol    Goal column.
 * @param endRow    Goal row.
 * @param gridCols  Grid width in cells (for bounds checking).
 * @param gridRows  Grid height in cells (for bounds checking).
 * @param isBlocked Callback — return true for impassable cells.
 * @returns Ordered array of cells from start to end (inclusive), or [] if no path.
 */
export function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  gridCols: number,
  gridRows: number,
  isBlocked: (col: number, row: number) => boolean,
): PathCell[] {
  const startKey = cellKey(startCol, startRow);
  const endKey = cellKey(endCol, endRow);

  if (startKey === endKey) return [{ col: startCol, row: startRow }];

  const open: Node[] = [];
  const closed = new Set<string>();
  const nodeMap = new Map<string, Node>();

  const startNode: Node = {
    col: startCol,
    row: startRow,
    g: 0,
    f: manhattan(startCol, startRow, endCol, endRow),
    parentKey: null,
  };
  open.push(startNode);
  nodeMap.set(startKey, startNode);

  while (open.length > 0) {
    // Find the node with the lowest f-score.
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open[bestIdx];
    const currentKey = cellKey(current.col, current.row);

    if (currentKey === endKey) {
      return reconstruct(nodeMap, current);
    }

    open.splice(bestIdx, 1);
    closed.add(currentKey);

    for (const dir of DIRS) {
      const nc = current.col + dir.dc;
      const nr = current.row + dir.dr;

      if (nc < 0 || nc >= gridCols || nr < 0 || nr >= gridRows) continue;

      const nKey = cellKey(nc, nr);
      if (closed.has(nKey)) continue;
      if (isBlocked(nc, nr)) continue;

      const tentativeG = current.g + 1;
      const existing = nodeMap.get(nKey);

      if (existing) {
        if (tentativeG >= existing.g) continue;
        existing.g = tentativeG;
        existing.f = tentativeG + manhattan(nc, nr, endCol, endRow);
        existing.parentKey = currentKey;
      } else {
        const node: Node = {
          col: nc,
          row: nr,
          g: tentativeG,
          f: tentativeG + manhattan(nc, nr, endCol, endRow),
          parentKey: currentKey,
        };
        open.push(node);
        nodeMap.set(nKey, node);
      }
    }
  }

  return [];
}

/** Walk back through parent pointers to reconstruct the path. */
function reconstruct(nodeMap: Map<string, Node>, end: Node): PathCell[] {
  const path: PathCell[] = [];
  let current: Node | undefined = end;
  while (current) {
    path.push({ col: current.col, row: current.row });
    current = current.parentKey ? nodeMap.get(current.parentKey) : undefined;
  }
  path.reverse();
  return path;
}
