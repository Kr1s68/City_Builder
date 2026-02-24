import { describe, it, expect } from "vitest";
import { BUILDING_DEFS, getBuildingDef, getAllBuildingTypes } from "../buildings";
import type { BuildingType } from "../buildings";
import { RESOURCE_TYPES } from "../resources";
import { BuildingEntity } from "../entities/BuildingEntity";

describe("Building catalogue", () => {
  it("has definitions for all expected building types", () => {
    const expected: BuildingType[] = ["house", "town_hall", "lumber_mill", "quarry", "farm", "storage", "market", "wall"];
    for (const type of expected) {
      expect(BUILDING_DEFS[type]).toBeDefined();
      expect(BUILDING_DEFS[type].type).toBe(type);
    }
  });

  it("getAllBuildingTypes returns all types", () => {
    const types = getAllBuildingTypes();
    expect(types.length).toBe(8);
    expect(types).toContain("house");
    expect(types).toContain("wall");
    expect(types).toContain("town_hall");
  });

  it("getBuildingDef returns the correct definition", () => {
    const def = getBuildingDef("lumber_mill");
    expect(def.name).toBe("Lumber Mill");
    expect(def.width).toBe(2);
    expect(def.height).toBe(2);
  });

  it("all definitions have valid costs (non-negative)", () => {
    for (const type of getAllBuildingTypes()) {
      const def = BUILDING_DEFS[type];
      for (const rt of RESOURCE_TYPES) {
        expect(def.cost[rt]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("all definitions have valid dimensions", () => {
    for (const type of getAllBuildingTypes()) {
      const def = BUILDING_DEFS[type];
      expect(def.width).toBeGreaterThan(0);
      expect(def.height).toBeGreaterThan(0);
    }
  });

  it("all definitions have positive maxHealth", () => {
    for (const type of getAllBuildingTypes()) {
      expect(BUILDING_DEFS[type].maxHealth).toBeGreaterThan(0);
    }
  });

  it("production buildings produce at least one resource", () => {
    const producers: BuildingType[] = ["lumber_mill", "quarry", "farm"];
    for (const type of producers) {
      const def = BUILDING_DEFS[type];
      const totalProduction = RESOURCE_TYPES.reduce((sum, rt) => sum + (def.production[rt] ?? 0), 0);
      expect(totalProduction).toBeGreaterThan(0);
    }
  });

  it("storage building provides capacity bonuses", () => {
    const def = BUILDING_DEFS["storage"];
    const totalBonus = RESOURCE_TYPES.reduce((sum, rt) => sum + (def.storageBonus[rt] ?? 0), 0);
    expect(totalBonus).toBeGreaterThan(0);
  });
});

describe("BuildingEntity", () => {
  it("creates entity with correct properties", () => {
    const def = getBuildingDef("lumber_mill");
    const entity = new BuildingEntity(10, 20, "lumber_mill", def.width, def.height, def.maxHealth);
    expect(entity.col).toBe(10);
    expect(entity.row).toBe(20);
    expect(entity.width).toBe(2);
    expect(entity.height).toBe(2);
    expect(entity.buildingType).toBe("lumber_mill");
    expect(entity.health).toBe(def.maxHealth);
    expect(entity.maxHealth).toBe(def.maxHealth);
  });

  it("supports damage and repair", () => {
    const entity = new BuildingEntity(0, 0, "quarry", 2, 2, 200);
    entity.takeDamage(50);
    expect(entity.health).toBe(150);
    expect(entity.isDestroyed).toBe(false);

    entity.repair(20);
    expect(entity.health).toBe(170);

    entity.takeDamage(200);
    expect(entity.isDestroyed).toBe(true);
    expect(entity.health).toBe(0);
  });

  it("has unique IDs", () => {
    const e1 = new BuildingEntity(0, 0, "farm", 3, 2, 80);
    const e2 = new BuildingEntity(5, 5, "market", 2, 2, 140);
    expect(e1.id).not.toBe(e2.id);
  });
});
