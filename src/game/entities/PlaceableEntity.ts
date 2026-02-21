/** Base class for anything that can be placed on the grid. */

import { generateId } from "./id";

export class PlaceableEntity {
  /** Unique identifier, auto-assigned on creation. */
  readonly id: number;
  /** Grid column of the top-left cell. */
  col: number;
  /** Grid row of the top-left cell. */
  row: number;
  /** Width in grid cells. */
  readonly width: number;
  /** Height in grid cells. */
  readonly height: number;

  constructor(col: number, row: number, width = 1, height = 1) {
    this.id = generateId();
    this.col = col;
    this.row = row;
    this.width = width;
    this.height = height;
  }
}
