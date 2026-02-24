/** Generic building entity driven by the BuildingDef catalogue.
 *
 *  Extends PlaceableEntity with a buildingType reference so the simulation
 *  can look up production, consumption, and storage bonuses from the catalogue.
 *  Used for all non-textured, non-wall buildings (TownHall, LumberMill, etc.).
 */

import { PlaceableEntity } from "./PlaceableEntity";
import type { BuildingType } from "../buildings";

export class BuildingEntity extends PlaceableEntity {
  /** References the BuildingDef catalogue entry. */
  readonly buildingType: BuildingType;
  /** Current health. */
  health: number;
  /** Max health from definition. */
  readonly maxHealth: number;

  constructor(col: number, row: number, buildingType: BuildingType, width: number, height: number, maxHealth: number) {
    super(col, row, width, height);
    this.buildingType = buildingType;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
  }

  /** Apply damage. Returns true if destroyed. */
  takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  /** Repair up to maxHealth. */
  repair(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  get isDestroyed(): boolean {
    return this.health <= 0;
  }
}
