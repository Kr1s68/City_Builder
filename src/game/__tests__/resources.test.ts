import { describe, it, expect } from "vitest";
import {
  createEconomyState,
  createResourceMap,
  canAfford,
  spendResources,
  addResources,
  addCapacity,
  removeCapacity,
  tickEconomy,
  getNetRate,
  RESOURCE_TYPES,
} from "../resources";

describe("createResourceMap", () => {
  it("creates a map with all values at default", () => {
    const map = createResourceMap();
    for (const type of RESOURCE_TYPES) {
      expect(map[type]).toBe(0);
    }
  });

  it("creates a map with custom default value", () => {
    const map = createResourceMap(42);
    for (const type of RESOURCE_TYPES) {
      expect(map[type]).toBe(42);
    }
  });
});

describe("createEconomyState", () => {
  it("creates state with starting resources", () => {
    const state = createEconomyState();
    expect(state.resources.gold).toBe(100);
    expect(state.resources.wood).toBe(50);
    expect(state.resources.stone).toBe(50);
    expect(state.resources.food).toBe(50);
  });

  it("creates state with default capacities", () => {
    const state = createEconomyState();
    expect(state.capacity.gold).toBe(500);
    expect(state.capacity.wood).toBe(300);
    expect(state.capacity.stone).toBe(300);
    expect(state.capacity.food).toBe(300);
  });

  it("starts with zero production and consumption", () => {
    const state = createEconomyState();
    for (const type of RESOURCE_TYPES) {
      expect(state.production[type]).toBe(0);
      expect(state.consumption[type]).toBe(0);
    }
  });
});

describe("canAfford", () => {
  it("returns true when resources are sufficient", () => {
    const state = createEconomyState();
    const cost = { ...createResourceMap(), gold: 50, wood: 20 };
    expect(canAfford(state, cost)).toBe(true);
  });

  it("returns false when any resource is insufficient", () => {
    const state = createEconomyState();
    const cost = { ...createResourceMap(), gold: 200 };
    expect(canAfford(state, cost)).toBe(false);
  });

  it("returns true for zero-cost", () => {
    const state = createEconomyState();
    expect(canAfford(state, createResourceMap())).toBe(true);
  });

  it("returns true when resources exactly match cost", () => {
    const state = createEconomyState();
    const cost = { ...createResourceMap(), gold: 100, wood: 50 };
    expect(canAfford(state, cost)).toBe(true);
  });
});

describe("spendResources", () => {
  it("deducts resources on success", () => {
    const state = createEconomyState();
    const cost = { ...createResourceMap(), gold: 30, wood: 10 };
    const result = spendResources(state, cost);
    expect(result).toBe(true);
    expect(state.resources.gold).toBe(70);
    expect(state.resources.wood).toBe(40);
  });

  it("returns false and does not deduct when insufficient", () => {
    const state = createEconomyState();
    const cost = { ...createResourceMap(), gold: 999 };
    const result = spendResources(state, cost);
    expect(result).toBe(false);
    expect(state.resources.gold).toBe(100); // unchanged
  });
});

describe("addResources", () => {
  it("adds resources up to capacity", () => {
    const state = createEconomyState();
    addResources(state, { gold: 100 });
    expect(state.resources.gold).toBe(200);
  });

  it("clamps to capacity", () => {
    const state = createEconomyState();
    addResources(state, { gold: 9999 });
    expect(state.resources.gold).toBe(500); // capacity
  });
});

describe("addCapacity / removeCapacity", () => {
  it("increases capacity", () => {
    const state = createEconomyState();
    addCapacity(state, { gold: 200 });
    expect(state.capacity.gold).toBe(700);
  });

  it("decreases capacity and clamps resources", () => {
    const state = createEconomyState();
    removeCapacity(state, { gold: 490 });
    expect(state.capacity.gold).toBe(10);
    expect(state.resources.gold).toBe(10); // clamped down
  });

  it("does not go below zero capacity", () => {
    const state = createEconomyState();
    removeCapacity(state, { gold: 9999 });
    expect(state.capacity.gold).toBe(0);
    expect(state.resources.gold).toBe(0);
  });
});

describe("tickEconomy", () => {
  it("applies production and consumption", () => {
    const state = createEconomyState();
    state.production.gold = 10;
    state.consumption.gold = 3;
    const net = tickEconomy(state);
    expect(state.resources.gold).toBe(107);
    expect(net.gold).toBe(7);
  });

  it("clamps resources to capacity", () => {
    const state = createEconomyState();
    state.resources.gold = 495;
    state.production.gold = 20;
    const net = tickEconomy(state);
    expect(state.resources.gold).toBe(500); // capacity
    expect(net.gold).toBe(5); // only 5 actually added
  });

  it("does not go below zero", () => {
    const state = createEconomyState();
    state.resources.gold = 5;
    state.consumption.gold = 20;
    const net = tickEconomy(state);
    expect(state.resources.gold).toBe(0);
    expect(net.gold).toBe(-5);
  });

  it("handles zero production and consumption", () => {
    const state = createEconomyState();
    const net = tickEconomy(state);
    expect(state.resources.gold).toBe(100); // unchanged
    expect(net.gold).toBe(0);
  });
});

describe("getNetRate", () => {
  it("computes net rates correctly", () => {
    const state = createEconomyState();
    state.production.gold = 10;
    state.consumption.gold = 3;
    state.production.food = 5;
    state.consumption.food = 8;
    const net = getNetRate(state);
    expect(net.gold).toBe(7);
    expect(net.food).toBe(-3);
    expect(net.wood).toBe(0);
  });
});
