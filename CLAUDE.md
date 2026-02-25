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
  │     ├── assets.ts    — Texture atlas builder (loads SVGs → GPU atlas + UV map)
  │     ├── camera.ts    — Orthographic camera: pan, zoom, VP matrix, screen↔world
  │     └── renderer/    — WebGPU abstraction
  │           ├── index.ts      — initRenderer() orchestrator (wires setup, pipelines, layers)
  │           ├── setup.ts      — WebGPU bootstrap (adapter, device, context, shared resources)
  │           ├── frame.ts      — createFrameFn() per-frame render pass orchestration
  │           ├── layers.ts     — FlatLayer/TexturedLayer abstractions (update + draw)
  │           ├── quads.ts      — CPU-side geometry builders (pre-allocated Float32Arrays)
  │           ├── types.ts      — Shared renderer interfaces (Renderer, GPUContext, etc.)
  │           ├── shaders/      — WGSL shader source strings (one file per shader)
  │           │     ├── grid.ts, quad.ts, preview.ts, path.ts, moveable.ts, textured.ts
  │           │     └── index.ts  — Barrel re-exports
  │           └── pipelines/    — GPURenderPipeline factories (one file per pipeline)
  │                 ├── grid.ts, quad.ts, preview.ts, path.ts, moveable.ts, textured.ts
  │                 ├── types.ts     — Pipeline return types (GridPipeline, QuadPipeline, etc.)
  │                 ├── constants.ts — Buffer size constants
  │                 ├── blend.ts     — Shared alpha blend state
  │                 └── index.ts     — Barrel re-exports
  └── game/              — Pure game state (no GPU code)
        ├── grid.ts          — Spatial index via module-level Maps; place/remove/query
        ├── pathfinder.ts    — Stateless A* (4-directional, Manhattan heuristic)
        ├── pathNetwork.ts   — Road network between buildings (incremental updates)
        └── entities/        — Entity class hierarchy
```

### Rendering Pipeline

Layers drawn back-to-front each frame: world background → path cells → placed buildings → textured buildings → moveable entities → placement preview → textured preview → grid lines. A single 64-byte uniform buffer (4x4 VP matrix) is shared across all shaders.

### Key Patterns

- **Render layers**: Each visual layer (path, building, preview, etc.) is wrapped in a `FlatLayer` or `TexturedLayer` struct that encapsulates the pipeline, CPU staging buffer, and draw logic. Layers are updated then drawn in back-to-front order via `updateFlatLayer()`/`drawFlatLayer()` (or textured equivalents).
- **Texture atlas**: All building sprites are SVGs in `public/textures/buildings/`. At init, `engine/assets.ts` composites them into a single atlas GPUTexture (4×2 grid, 128px cells). Per-entity UV regions are resolved via a `Map<string, UVRegion>` keyed by `BuildingType`.
- **Entity discrimination**: `if ("texture" in entity)` routes to textured vs flat-color pipeline. All building entities (`HouseEntity`, `BuildingEntity`, `WallEntity`) have a `texture` property matching their `BuildingType` key. `MoveableEntity` is separate (NPCs, not buildings).
- **Cell key format**: `"col,row"` string used consistently across `grid.ts`, `pathfinder.ts`, and `pathNetwork.ts`.
- **Pre-allocated GPU buffers**: All vertex buffers and CPU-side Float32Arrays are allocated at max size (`MAX_QUADS = 4096`) at startup — only the used portion is uploaded each frame.
- **Textured quads**: UVs are vertically flipped (`v:1` at top, `v:0` at bottom). Textured buildings extend beyond footprint with padding for a height illusion.
- **Path network**: Each building connects to its single nearest neighbor (`MAX_NEIGHBOURS = 1`). New buildings near existing paths use a bridge shortcut to avoid expensive A*.

### Stub Files

Many modules (`engine/audio.ts`, `game/save.ts`, `ui/*`) are empty stubs (`export {}`) reserved for future implementation.
