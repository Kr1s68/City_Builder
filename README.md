# City Builder

A web-based idle city builder game rendered with WebGPU.

## Prerequisites

- Node.js 18+
- A browser with WebGPU support (Chrome 113+, Edge 113+)

## Getting started

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Controls

- **Pan** &mdash; Middle-mouse drag, Alt + left-click drag, or WASD / arrow keys
- **Zoom** &mdash; Scroll wheel
- **Place entity** &mdash; Click "New Entity", then click on the grid
- **Toggle grid** &mdash; Click "Grid" to overlay debug grid lines

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |

## Tech stack

- **Renderer** &mdash; WebGPU (WGSL shaders)
- **Bundler** &mdash; Vite
- **Language** &mdash; TypeScript (strict)
