import { describe, it, expect } from "vitest";
import { createEconomyState, RESOURCE_TYPES } from "../resources";
import { recalculateRates } from "../simulation";

describe("recalculateRates", () => {
  it("sets zero rates when no buildings are placed", () => {
    const state = createEconomyState();
    recalculateRates(state);
    for (const type of RESOURCE_TYPES) {
      expect(state.production[type]).toBe(0);
      expect(state.consumption[type]).toBe(0);
    }
  });

  it("resets capacity to base values when no buildings are placed", () => {
    const state = createEconomyState();
    // Manually corrupt capacity
    state.capacity.gold = 9999;
    recalculateRates(state);
    expect(state.capacity.gold).toBe(500);
    expect(state.capacity.wood).toBe(300);
  });
});
