/** Entity that follows the path network between buildings.
 *  Falls back to random walk when no path network exists.
 */

import { generateId } from "./id";
import { findNavigationPath, getBuildingDoors, isPathCell } from "../pathNetwork";

/** The 8 neighbouring directions — used as fallback when no paths exist. */
const DIRECTIONS = [
  { dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 },
  { dc: -1, dr:  0 },                     { dc: 1, dr:  0 },
  { dc: -1, dr:  1 }, { dc: 0, dr:  1 }, { dc: 1, dr:  1 },
];

/** Number of ticks to wait at a destination before picking a new one. */
const IDLE_TICKS = 3;

export class MoveableEntity {
  readonly id: number;
  col: number;
  row: number;

  /** Planned navigation route (sequence of cells to visit). */
  private currentPath: { col: number; row: number }[] = [];
  /** Index of the next cell to move to in currentPath. */
  private pathIndex = 0;
  /** Remaining idle ticks before picking a new destination. */
  private idleTicksLeft = 0;

  constructor(col: number, row: number) {
    this.id = generateId();
    this.col = col;
    this.row = row;
  }

  /**
   * Advance one step along the path network.
   * If no path network exists (fewer than 2 buildings), falls back to random walk.
   */
  step(gridCols: number, gridRows: number): void {
    // --- Idle cooldown at destination ---
    if (this.idleTicksLeft > 0) {
      this.idleTicksLeft--;
      return;
    }

    // --- Follow current path ---
    if (this.pathIndex < this.currentPath.length) {
      const next = this.currentPath[this.pathIndex];
      this.col = next.col;
      this.row = next.row;
      this.pathIndex++;
      return;
    }

    // --- Pick a new destination ---
    const doors = getBuildingDoors();
    if (doors.length === 0) {
      this.randomStep(gridCols, gridRows);
      return;
    }

    // Walk to the nearest path cell first if we're not already on one.
    const target = doors[Math.floor(Math.random() * doors.length)];
    const navPath = findNavigationPath(this.col, this.row, target.col, target.row);

    if (navPath.length > 1) {
      // Skip the first cell (our current position).
      this.currentPath = navPath.slice(1);
      this.pathIndex = 0;
      // Take the first step immediately.
      const next = this.currentPath[this.pathIndex];
      this.col = next.col;
      this.row = next.row;
      this.pathIndex++;
    } else {
      // No navigable path — if we're on a path cell, stay put;
      // otherwise random walk towards the network.
      if (!isPathCell(this.col, this.row)) {
        this.randomStep(gridCols, gridRows);
      }
    }

    // When the path completes next tick, idle for a few ticks.
    if (this.pathIndex >= this.currentPath.length) {
      this.idleTicksLeft = IDLE_TICKS;
    }
  }

  /** Reset navigation state — called when the path network regenerates. */
  clearPath(): void {
    this.currentPath = [];
    this.pathIndex = 0;
    this.idleTicksLeft = 0;
  }

  /** Fallback: pick a random neighbouring cell (original behaviour). */
  private randomStep(gridCols: number, gridRows: number): void {
    const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    const nc = this.col + dir.dc;
    const nr = this.row + dir.dr;
    if (nc >= 0 && nc < gridCols && nr >= 0 && nr < gridRows) {
      this.col = nc;
      this.row = nr;
    }
  }
}
