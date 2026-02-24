/** Resource types, production rates, and storage.
 *
 *  The economy is built around four core resources: gold, wood, stone, and food.
 *  Each resource has a current amount, storage cap, and per-tick production/consumption rates.
 *  All calculations are deterministic — the same inputs always produce the same outputs.
 */

// ---------------------------------------------------------------------------
// Resource type definitions
// ---------------------------------------------------------------------------

/** All resource types in the game. Extensible by adding new entries. */
export type ResourceType = "gold" | "wood" | "stone" | "food";

/** All valid resource types, used for iteration. */
export const RESOURCE_TYPES: readonly ResourceType[] = ["gold", "wood", "stone", "food"];

/** A record mapping each resource type to a numeric value. */
export type ResourceMap = Record<ResourceType, number>;

/** Creates a ResourceMap with all values set to a given default. */
export function createResourceMap(defaultValue = 0): ResourceMap {
  return { gold: defaultValue, wood: defaultValue, stone: defaultValue, food: defaultValue };
}

// ---------------------------------------------------------------------------
// Economy state
// ---------------------------------------------------------------------------

/** The full economy state, designed for serialisation and deterministic updates. */
export interface EconomyState {
  /** Current amount of each resource. */
  resources: ResourceMap;
  /** Maximum storage capacity for each resource. */
  capacity: ResourceMap;
  /** Net production rate per tick for each resource (production - consumption). */
  production: ResourceMap;
  /** Gross consumption rate per tick for each resource. */
  consumption: ResourceMap;
}

/** Default starting economy values. */
const DEFAULT_CAPACITY: ResourceMap = { gold: 500, wood: 300, stone: 300, food: 300 };
const DEFAULT_STARTING: ResourceMap = { gold: 100, wood: 50, stone: 50, food: 50 };

/** Create a fresh economy state with starting resources. */
export function createEconomyState(): EconomyState {
  return {
    resources: { ...DEFAULT_STARTING },
    capacity: { ...DEFAULT_CAPACITY },
    production: createResourceMap(),
    consumption: createResourceMap(),
  };
}

// ---------------------------------------------------------------------------
// Economy operations (pure functions — no side effects)
// ---------------------------------------------------------------------------

/** Check whether the economy has enough resources to cover a cost. */
export function canAfford(state: EconomyState, cost: ResourceMap): boolean {
  for (const type of RESOURCE_TYPES) {
    if (state.resources[type] < cost[type]) return false;
  }
  return true;
}

/** Deduct a cost from the economy. Returns false if funds are insufficient. */
export function spendResources(state: EconomyState, cost: ResourceMap): boolean {
  if (!canAfford(state, cost)) return false;
  for (const type of RESOURCE_TYPES) {
    state.resources[type] -= cost[type];
  }
  return true;
}

/** Add resources, clamped to storage capacity. */
export function addResources(state: EconomyState, amounts: Partial<ResourceMap>): void {
  for (const type of RESOURCE_TYPES) {
    const add = amounts[type] ?? 0;
    state.resources[type] = Math.min(
      state.resources[type] + add,
      state.capacity[type],
    );
  }
}

/** Increase storage capacity by the given amounts. */
export function addCapacity(state: EconomyState, amounts: Partial<ResourceMap>): void {
  for (const type of RESOURCE_TYPES) {
    state.capacity[type] += amounts[type] ?? 0;
  }
}

/** Decrease storage capacity (e.g., when a storage building is demolished). */
export function removeCapacity(state: EconomyState, amounts: Partial<ResourceMap>): void {
  for (const type of RESOURCE_TYPES) {
    state.capacity[type] = Math.max(0, state.capacity[type] - (amounts[type] ?? 0));
    // Clamp current resources if capacity dropped below them
    state.resources[type] = Math.min(state.resources[type], state.capacity[type]);
  }
}

/** Update production rates — typically called when buildings change. */
export function setProductionRate(state: EconomyState, type: ResourceType, rate: number): void {
  state.production[type] = rate;
}

/** Update consumption rates — typically called when buildings change. */
export function setConsumptionRate(state: EconomyState, type: ResourceType, rate: number): void {
  state.consumption[type] = rate;
}

/**
 * Apply one economy tick: add production, subtract consumption, clamp to capacity.
 * Returns the net change for each resource (useful for UI display).
 */
export function tickEconomy(state: EconomyState): ResourceMap {
  const net = createResourceMap();
  for (const type of RESOURCE_TYPES) {
    const delta = state.production[type] - state.consumption[type];
    const before = state.resources[type];
    state.resources[type] = Math.max(
      0,
      Math.min(state.resources[type] + delta, state.capacity[type]),
    );
    net[type] = state.resources[type] - before;
  }
  return net;
}

/** Compute the net rate (production - consumption) for display purposes. */
export function getNetRate(state: EconomyState): ResourceMap {
  const net = createResourceMap();
  for (const type of RESOURCE_TYPES) {
    net[type] = state.production[type] - state.consumption[type];
  }
  return net;
}
