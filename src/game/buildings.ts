/** Building definitions catalogue.
 *
 *  Data-driven building configs that define costs, sizes, production, and effects.
 *  Each building type is a plain object — entity classes handle runtime state.
 *  Designed for future extensibility: upgrades, level tiers, modifiers.
 */

import type { ResourceMap } from "./resources";
import { createResourceMap } from "./resources";

// ---------------------------------------------------------------------------
// Building type identifiers
// ---------------------------------------------------------------------------

/** All building types in the game. Add new entries here to extend the catalogue. */
export type BuildingType =
  | "house"
  | "town_hall"
  | "lumber_mill"
  | "quarry"
  | "farm"
  | "storage"
  | "market"
  | "wall";

// ---------------------------------------------------------------------------
// Building definition interface
// ---------------------------------------------------------------------------

/** Static definition for a building type. Immutable after creation. */
export interface BuildingDef {
  /** Unique type identifier. */
  type: BuildingType;
  /** Display name for UI. */
  name: string;
  /** Short description for tooltips. */
  description: string;
  /** Grid footprint in cells. */
  width: number;
  height: number;
  /** Resource cost to construct. */
  cost: ResourceMap;
  /** Resources produced per economy tick. */
  production: Partial<ResourceMap>;
  /** Resources consumed per economy tick. */
  consumption: Partial<ResourceMap>;
  /** Additional storage capacity this building provides. */
  storageBonus: Partial<ResourceMap>;
  /** Construction time in seconds (0 = instant). */
  buildTime: number;
  /** Maximum health points. */
  maxHealth: number;
  /** Whether a texture path is available for rendering. */
  textured: boolean;
}

// ---------------------------------------------------------------------------
// Building catalogue
// ---------------------------------------------------------------------------

/** Helper to create a cost map from partial values. */
function cost(partial: Partial<ResourceMap>): ResourceMap {
  return { ...createResourceMap(), ...partial };
}

/** The master catalogue of all building definitions. */
export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  house: {
    type: "house",
    name: "House",
    description: "A small dwelling that houses citizens.",
    width: 4,
    height: 4,
    cost: cost({ wood: 30, stone: 10 }),
    production: { gold: 1 },
    consumption: { food: 1 },
    storageBonus: {},
    buildTime: 5,
    maxHealth: 150,
    textured: true,
  },

  town_hall: {
    type: "town_hall",
    name: "Town Hall",
    description:
      "The administrative centre of your settlement. Generates a small gold income.",
    width: 4,
    height: 4,
    cost: cost({ wood: 100, stone: 80, gold: 50 }),
    production: { gold: 5 },
    consumption: {},
    storageBonus: { gold: 200 },
    buildTime: 15,
    maxHealth: 500,
    textured: true,
  },

  lumber_mill: {
    type: "lumber_mill",
    name: "Lumber Mill",
    description: "Harvests wood from nearby forests.",
    width: 4,
    height: 4,
    cost: cost({ wood: 20, stone: 10, gold: 15 }),
    production: { wood: 3 },
    consumption: { food: 1 },
    storageBonus: {},
    buildTime: 8,
    maxHealth: 120,
    textured: true,
  },

  quarry: {
    type: "quarry",
    name: "Quarry",
    description: "Extracts stone from the earth.",
    width: 4,
    height: 4,
    cost: cost({ wood: 25, gold: 20 }),
    production: { stone: 3 },
    consumption: { food: 1 },
    storageBonus: {},
    buildTime: 10,
    maxHealth: 200,
    textured: true,
  },

  farm: {
    type: "farm",
    name: "Farm",
    description: "Grows crops to feed the population.",
    width: 4,
    height: 4,
    cost: cost({ wood: 15, gold: 10 }),
    production: { food: 4 },
    consumption: {},
    storageBonus: { food: 50 },
    buildTime: 6,
    maxHealth: 80,
    textured: true,
  },

  storage: {
    type: "storage",
    name: "Storehouse",
    description: "Increases resource storage capacity across all types.",
    width: 4,
    height: 4,
    cost: cost({ wood: 40, stone: 30, gold: 20 }),
    production: {},
    consumption: {},
    storageBonus: { gold: 200, wood: 150, stone: 150, food: 150 },
    buildTime: 8,
    maxHealth: 180,
    textured: true,
  },

  market: {
    type: "market",
    name: "Market",
    description:
      "A trading post. Generates gold and is ready for future trade integration.",
    width: 4,
    height: 4,
    cost: cost({ wood: 35, stone: 25, gold: 30 }),
    production: { gold: 3 },
    consumption: { food: 1 },
    storageBonus: { gold: 100 },
    buildTime: 10,
    maxHealth: 140,
    textured: true,
  },

  wall: {
    type: "wall",
    name: "Wall",
    description: "A defensive wall segment. Protects against attacks.",
    width: 1,
    height: 1,
    cost: cost({ stone: 5, wood: 2 }),
    production: {},
    consumption: {},
    storageBonus: {},
    buildTime: 2,
    maxHealth: 100,
    textured: true,
  },
};

/** Get a building definition by type. */
export function getBuildingDef(type: BuildingType): BuildingDef {
  return BUILDING_DEFS[type];
}

/** Get all building types available for placement. */
export function getAllBuildingTypes(): BuildingType[] {
  return Object.keys(BUILDING_DEFS) as BuildingType[];
}
