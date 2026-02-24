/** Simulation tick — recalculates production/consumption from placed buildings
 *  and advances the economy by one tick.
 *
 *  Designed as a pure-function pipeline:
 *    1. Scan all placed entities → aggregate production & consumption rates.
 *    2. Apply one economy tick (add production, subtract consumption, clamp).
 *
 *  No hidden state — all inputs and outputs flow through the EconomyState.
 */

import { getAllEntities } from "./grid";
import type { EconomyState, ResourceMap } from "./resources";
import {
  RESOURCE_TYPES,
  createResourceMap,
  tickEconomy,
  addCapacity,
  removeCapacity,
} from "./resources";
import type { BuildingType } from "./buildings";
import { BUILDING_DEFS } from "./buildings";

// ---------------------------------------------------------------------------
// Rate recalculation
// ---------------------------------------------------------------------------

/**
 * Determine the BuildingType of a placed entity by inspecting its runtime properties.
 * Returns undefined for entities that are not economy-relevant (e.g., PlaceholderEntity).
 */
function entityBuildingType(entity: { buildingType?: string; texture?: string; defence?: number }): BuildingType | undefined {
  // BuildingEntity and WallEntity carry a buildingType property
  if ("buildingType" in entity && typeof entity.buildingType === "string") {
    return entity.buildingType as BuildingType;
  }
  // HouseEntity: identified by texture property (legacy support)
  if ("texture" in entity) return "house";
  // WallEntity: identified by defence property (legacy support)
  if ("defence" in entity) return "wall";
  return undefined;
}

/**
 * Scan all placed entities and recalculate aggregate production, consumption,
 * and total storage bonus. Called once per tick or whenever buildings change.
 */
export function recalculateRates(state: EconomyState): void {
  const production = createResourceMap();
  const consumption = createResourceMap();

  // Reset capacity to base, then re-add all building bonuses
  const baseCapacity = { gold: 500, wood: 300, stone: 300, food: 300 };
  for (const type of RESOURCE_TYPES) {
    state.capacity[type] = baseCapacity[type];
  }

  for (const entity of getAllEntities()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bt = entityBuildingType(entity as any);
    if (!bt) continue;

    const def = BUILDING_DEFS[bt];
    if (!def) continue;

    // Aggregate production
    for (const type of RESOURCE_TYPES) {
      production[type] += def.production[type] ?? 0;
      consumption[type] += def.consumption[type] ?? 0;
    }

    // Add storage bonuses
    addCapacity(state, def.storageBonus);
  }

  state.production = production;
  state.consumption = consumption;
}

/**
 * Run one simulation tick:
 *  1. Recalculate rates from current buildings.
 *  2. Apply one economy tick.
 *
 * Returns the net resource change for UI feedback.
 */
export function simulationTick(state: EconomyState): ResourceMap {
  recalculateRates(state);
  return tickEconomy(state);
}
