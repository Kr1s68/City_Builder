import { describe, it, expect } from "vitest";
import { WallEntity } from "../entities/WallEntity";

describe("WallEntity", () => {
  it("creates a 1×1 entity with default health", () => {
    const wall = new WallEntity(5, 10);
    expect(wall.col).toBe(5);
    expect(wall.row).toBe(10);
    expect(wall.width).toBe(1);
    expect(wall.height).toBe(1);
    expect(wall.health).toBe(100);
    expect(wall.maxHealth).toBe(100);
    expect(wall.defence).toBe(5);
    expect(wall.level).toBe(1);
  });

  it("accepts custom config", () => {
    const wall = new WallEntity(0, 0, { maxHealth: 200, defence: 10, level: 2 });
    expect(wall.maxHealth).toBe(200);
    expect(wall.health).toBe(200);
    expect(wall.defence).toBe(10);
    expect(wall.level).toBe(2);
  });

  it("applies partial config and merges with defaults", () => {
    const wall = new WallEntity(0, 0, { maxHealth: 50 });
    expect(wall.maxHealth).toBe(50);
    expect(wall.defence).toBe(5); // default
    expect(wall.level).toBe(1);   // default
  });

  it("has a unique auto-incrementing ID", () => {
    const w1 = new WallEntity(0, 0);
    const w2 = new WallEntity(1, 1);
    expect(w1.id).not.toBe(w2.id);
    expect(w2.id).toBeGreaterThan(w1.id);
  });

  describe("takeDamage", () => {
    it("reduces health by the given amount", () => {
      const wall = new WallEntity(0, 0);
      wall.takeDamage(30);
      expect(wall.health).toBe(70);
    });

    it("returns false when wall survives", () => {
      const wall = new WallEntity(0, 0);
      expect(wall.takeDamage(50)).toBe(false);
      expect(wall.isDestroyed).toBe(false);
    });

    it("returns true when wall is destroyed", () => {
      const wall = new WallEntity(0, 0);
      expect(wall.takeDamage(100)).toBe(true);
      expect(wall.isDestroyed).toBe(true);
      expect(wall.health).toBe(0);
    });

    it("clamps health to zero (no negative)", () => {
      const wall = new WallEntity(0, 0);
      wall.takeDamage(999);
      expect(wall.health).toBe(0);
    });
  });

  describe("repair", () => {
    it("increases health", () => {
      const wall = new WallEntity(0, 0);
      wall.takeDamage(50);
      wall.repair(20);
      expect(wall.health).toBe(70);
    });

    it("clamps to maxHealth", () => {
      const wall = new WallEntity(0, 0);
      wall.takeDamage(10);
      wall.repair(999);
      expect(wall.health).toBe(100);
    });
  });

  describe("healthFraction", () => {
    it("returns 1 at full health", () => {
      const wall = new WallEntity(0, 0);
      expect(wall.healthFraction).toBe(1);
    });

    it("returns 0 when destroyed", () => {
      const wall = new WallEntity(0, 0);
      wall.takeDamage(100);
      expect(wall.healthFraction).toBe(0);
    });

    it("returns correct fraction", () => {
      const wall = new WallEntity(0, 0, { maxHealth: 200 });
      wall.takeDamage(50);
      expect(wall.healthFraction).toBe(0.75);
    });
  });
});
