/** A 2×2 test entity for verifying placement. */

import { PlaceableEntity } from "./PlaceableEntity";

export class PlaceholderEntity extends PlaceableEntity {
  constructor(col: number, row: number) {
    super(col, row, 2, 2);
  }
}
