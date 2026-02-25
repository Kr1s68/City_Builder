/** A 1×1 wall segment with health and durability tracking.
 *
 *  Walls are defensive structures that can be placed individually.
 *  They support damage, repair, and future upgrade paths (e.g., gates, reinforcement).
 */

import { PlaceableEntity } from "./PlaceableEntity";

/** Configuration for wall properties, enabling data-driven balancing. */
export interface WallConfig {
  /** Maximum hit points when fully constructed. */
  maxHealth: number;
  /** Defence rating — used by future combat calculations. */
  defence: number;
  /** Level of the wall (1 = basic wood, 2 = stone, 3 = fortified). */
  level: number;
}

/** Default configuration for a level-1 wooden wall. */
const DEFAULT_WALL_CONFIG: WallConfig = {
  maxHealth: 100,
  defence: 5,
  level: 1,
};

export class WallEntity extends PlaceableEntity {
  /** Building type key for atlas UV lookup — routes this entity to the textured pipeline. */
  readonly texture = "wall";
  /** Current hit points. Reaches 0 when the wall is destroyed. */
  health: number;
  /** Maximum hit points for this wall type. */
  readonly maxHealth: number;
  /** Defence rating modifier for combat calculations. */
  readonly defence: number;
  /** Wall tier — determines visual style and stats in future upgrades. */
  readonly level: number;

  constructor(col: number, row: number, config: Partial<WallConfig> = {}) {
    super(col, row, 1, 1); // Walls occupy a single cell
    const resolved = { ...DEFAULT_WALL_CONFIG, ...config };
    this.maxHealth = resolved.maxHealth;
    this.health = resolved.maxHealth;
    this.defence = resolved.defence;
    this.level = resolved.level;
  }

  /** Apply damage to the wall. Returns true if the wall is destroyed (health ≤ 0). */
  takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  /** Repair the wall by the given amount, up to maxHealth. */
  repair(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  /** Whether this wall is still standing. */
  get isDestroyed(): boolean {
    return this.health <= 0;
  }

  /** Health as a 0–1 fraction, useful for rendering health bars. */
  get healthFraction(): number {
    return this.health / this.maxHealth;
  }
}
