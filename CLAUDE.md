# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `npm run dev` — Start Vite dev server with HMR at `http://localhost:5173`
- `npm run build` — Type-check with `tsc` then bundle to `dist/`
- `npm run preview` — Serve the production build locally

No test framework is configured. No linter is configured.

## Architecture

This is a 2D city-builder game with a **hand-rolled WebGPU renderer** (no game engine or UI framework). Bundled with Vite, written in strict TypeScript.

### Layer Separation

```
src/main.ts              — Orchestrator: wires engine + game + input together
  ├── engine/            — Rendering and camera (no game logic)
  │     ├── camera.ts    — Orthographic camera: pan, zoom, VP matrix, screen↔world
  │     └── renderer/    — WebGPU abstraction
  │           ├── index.ts      — initRenderer(), frame() per-frame submission
  │           ├── shaders.ts    — WGSL shader source strings
  │           ├── pipelines.ts  — GPURenderPipeline factories (compiled once at startup)
  │           ├── quads.ts      — CPU-side geometry builders (pre-allocated Float32Arrays)
  │           └── types.ts      — Shared renderer interfaces
  └── game/              — Pure game state (no GPU code)
        ├── grid.ts          — Spatial index via module-level Maps; place/remove/query
        ├── pathfinder.ts    — Stateless A* (4-directional, Manhattan heuristic)
        ├── pathNetwork.ts   — Road network between buildings (incremental updates)
        └── entities/        — Entity class hierarchy
```

### Rendering Pipeline

Layers drawn back-to-front each frame: path cells → placed buildings → textured buildings → moveable entities → placement preview → textured preview → grid lines. A single 64-byte uniform buffer (4x4 VP matrix) is shared across all shaders.

### Key Patterns

- **Entity discrimination**: `if ("texture" in entity)` routes to textured vs flat-color pipeline. `PlaceableEntity` is the base class; `HouseEntity` adds a `texture` property; `MoveableEntity` is separate (NPCs, not buildings).
- **Cell key format**: `"col,row"` string used consistently across `grid.ts`, `pathfinder.ts`, and `pathNetwork.ts`.
- **Pre-allocated GPU buffers**: All vertex buffers and CPU-side Float32Arrays are allocated at max size (`MAX_QUADS = 4096`) at startup — only the used portion is uploaded each frame.
- **Textured quads**: UVs are vertically flipped (`v:1` at top, `v:0` at bottom). Textured buildings extend beyond footprint with padding for a height illusion.
- **Path network**: Each building connects to its single nearest neighbor (`MAX_NEIGHBOURS = 1`). New buildings near existing paths use a bridge shortcut to avoid expensive A*.

### Stub Files

Many modules (`engine/assets.ts`, `engine/audio.ts`, `game/buildings.ts`, `game/resources.ts`, `game/simulation.ts`, `game/save.ts`, `ui/*`) are empty stubs (`export {}`) reserved for future implementation.
