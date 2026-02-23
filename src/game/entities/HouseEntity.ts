/** A 2×2 house building with a build timer and texture. */

import { PlaceableEntity } from "./PlaceableEntity";

export class HouseEntity extends PlaceableEntity {
  /** Path to the building's texture (relative to public/). */
  readonly texture = "public/textures/buildings/house-placeholder.png";
  /** Time in seconds required to construct this building. */
  readonly buildTime: number;

  constructor(col: number, row: number, buildTime = 0) {
    super(col, row, 2, 2);
    this.buildTime = buildTime;
  }
}
