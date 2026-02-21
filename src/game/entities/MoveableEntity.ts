/** Entity that wanders the grid by randomly stepping to a neighbour. */

import { generateId } from "./id";

/** The 8 neighbouring directions (including diagonals). */
const DIRECTIONS = [
  { dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 },
  { dc: -1, dr:  0 },                     { dc: 1, dr:  0 },
  { dc: -1, dr:  1 }, { dc: 0, dr:  1 }, { dc: 1, dr:  1 },
];

export class MoveableEntity {
  readonly id: number;
  col: number;
  row: number;

  constructor(col: number, row: number) {
    this.id = generateId();
    this.col = col;
    this.row = row;
  }

  /** Pick a random valid neighbouring cell and move there. */
  step(gridCols: number, gridRows: number): void {
    const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    const nc = this.col + dir.dc;
    const nr = this.row + dir.dr;
    if (nc >= 0 && nc < gridCols && nr >= 0 && nr < gridRows) {
      this.col = nc;
      this.row = nr;
    }
  }
}
