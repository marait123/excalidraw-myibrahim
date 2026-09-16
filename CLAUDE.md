# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Excalidraw is a **Yarn workspaces monorepo** (`"workspaces": ["excalidraw-app", "packages/*", "examples/*"]`, root `name: excalidraw-monorepo`) built around a layered dependency graph: shared, framework-agnostic packages at the bottom, the editor library in the middle, and the excalidraw.com web app on top.

```
excalidraw-myibrahim/
├── packages/
│   ├── common/               @excalidraw/common — constants, keys, utility types (no internal deps)
│   ├── math/                 @excalidraw/math — pure 2D geometry, depends on common
│   ├── element/               @excalidraw/element — element data model + low-level rendering, depends on common+math
│   ├── excalidraw/           @excalidraw/excalidraw — the editor product (npm package), depends on common+math+element
│   ├── utils/                 @excalidraw/utils — export/shape helpers bundled with the above for embedders
│   ├── fractional-indexing/  ordering primitive used by element
│   └── laser-pointer/        laser pointer tool implementation
├── excalidraw-app/           excalidraw.com — Vite web app consuming @excalidraw/excalidraw
├── examples/
│   ├── with-nextjs/          Next.js SSR integration example
│   └── with-script-in-browser/  plain <script> integration example
└── scripts/                  build scripts (esbuild configs, release, locale coverage)
```

Each package/app below has its own `CLAUDE.md` with directory-specific detail — read it when working inside that tree:

- [packages/excalidraw/CLAUDE.md](packages/excalidraw/CLAUDE.md) — main editor library (components, actions, rendering, state)
- [packages/element/CLAUDE.md](packages/element/CLAUDE.md) — element data model, mutation, binding, versioning
- [packages/math/CLAUDE.md](packages/math/CLAUDE.md) — geometry primitives, branded Point types
- [packages/common/CLAUDE.md](packages/common/CLAUDE.md) — shared constants and utility types
- [packages/utils/CLAUDE.md](packages/utils/CLAUDE.md) — export/shape helpers for embedders
- [excalidraw-app/CLAUDE.md](excalidraw-app/CLAUDE.md) — excalidraw.com app: collab, storage, PWA, sharing

## Development Commands

```bash
yarn start                # dev server for excalidraw-app (Vite, default port 3000 via VITE_APP_PORT)
yarn build                # production build of excalidraw-app
yarn build:packages       # build all shared packages (common → fractional-indexing → laser-pointer → math → element → excalidraw)
yarn build:excalidraw     # build just @excalidraw/excalidraw (or build:common/build:element/build:math for a single package)

yarn test                 # = yarn test:app -> vitest in watch mode
yarn test <pattern>       # run/filter a subset, e.g. yarn test packages/excalidraw/tests/App.test.tsx
yarn test:update          # full vitest run, non-watch, updates snapshots (run before committing)
yarn test:typecheck       # tsc across the whole repo
yarn test:code            # eslint --max-warnings=0
yarn test:other           # prettier --list-different
yarn test:all             # typecheck + lint + prettier check + full test run

yarn fix                  # prettier --write + eslint --fix
```

Notes:

- `yarn start`'s script is `yarn && vite` — the first run in a fresh checkout re-installs dependencies before booting the dev server, which can take several minutes; this is expected, not a hang.
- If port 3000 is taken, Vite silently picks the next free port (e.g. 3001) — check the terminal/log output for the actual URL.
- There is no separate "watch" script for a single test file beyond passing a path filter to `yarn test`.

## Architecture

### Package dependency graph and responsibilities

```
common  →  math  →  element  →  excalidraw  →  excalidraw-app
              (utils bundles common+math+element+excalidraw together for embedders)
```

- **`@excalidraw/common`** — bottom of the graph, zero internal deps. Constants, keyboard/cursor enums, the `Merge<M, N>` and other utility types, a small pub-sub event bus.
- **`@excalidraw/math`** — pure geometry (points, vectors, lines, curves, angles), no DOM/React dependency. Coordinates are branded tuple types (`GlobalPoint`/`LocalPoint`), not `{x, y}` objects, to prevent mixing coordinate spaces and to stay allocation-light.
- **`@excalidraw/element`** — the domain layer: the `ExcalidrawElement` type hierarchy, element creation/mutation (`mutateElement`), the `Scene` class (element registry), binding of arrows to shapes, z-ordering via fractional indices, hit-testing/collision, and the actual per-element canvas drawing primitive (`renderElement`).
- **`@excalidraw/excalidraw`** — "the editor product": the `<Excalidraw>` React component, the `App` class (owns most orchestration logic), the actions/command-pattern system, scene-level rendering orchestration (frame clipping, dark mode, snapping), persistence helpers, i18n, and fonts. Treats `@excalidraw/element` as the source of truth for element data.
- **`@excalidraw/utils`** — not a peer of the above despite living alongside them; it's a leaf bundle (via `scripts/buildUtils.js`) that inlines `common`+`element`+`math`+`excalidraw` for convenience export/shape helpers, whereas the other packages build via `scripts/buildBase.js` and mark siblings external.
- **`excalidraw-app`** — consumes `@excalidraw/excalidraw` and adds everything the README calls out as app-only (not yet part of the reusable npm package): real-time collaboration, end-to-end encryption, local-first autosave, PWA/offline support, and shareable links.

### Cross-cutting patterns worth knowing before editing code

- **State is deliberately split three ways** in `packages/excalidraw`: `AppState` (zoom, selection, tool, etc.) lives as React class state on `App`; element data lives outside React entirely, owned by a `Scene` instance and mutated imperatively; small cross-cutting UI state (dialogs, color picker, sidebar) uses Jotai, scoped per `<Excalidraw>` instance so multiple mounts on one page don't share atoms.
- **Elements are mutated via `mutateElement`/`Scene` APIs, not `setState`.** Any change to drawing/element logic goes through `@excalidraw/element`, not through React state updates.
- **Actions are a command pattern**: every user-triggerable operation (toolbar button, menu item, keyboard shortcut) is an `Action` object registered with a central `ActionManager`, not an ad-hoc event handler.
- Builds use **esbuild** for the packages and **Vite** for the app; path aliases for `@excalidraw/*` packages are defined in root `tsconfig.base.json` and mirrored in `vitest.config.mts` (pointing straight at each package's `src`), so tests and typechecking run against source, not built output.

## Non-negotiable: stay file-format compatible with upstream Excalidraw

This fork adds features on top of Excalidraw, but **a `.excalidraw` file written here must open in the real excalidraw.com, and any file from excalidraw.com must open here** — same for `.excalidrawlib` libraries and the PNG/SVG "embed scene" payloads.

Practically, that means:

- **Never change the serialized shape** of a scene or an element. Treat `packages/excalidraw/data/json.ts` (`serializeAsJSON`/`serializeLibraryAsJSON`), `data/blob.ts`, `data/restore.ts`, `data/encode.ts`, `packages/element/src/types.ts` and `scene/export.ts` as upstream-owned. Don't add fields to `ExcalidrawElement`, don't add top-level keys to the exported JSON, and don't bump `VERSIONS`/`EXPORT_DATA_TYPES`.
- **Fork-specific state goes in app-level storage, not in the file.** The multi-project workspace is the model to copy: projects live in IndexedDB (`excalidraw-app/data/projects.ts`) and each project stores a plain elements array + the same `StorableAppState` subset upstream already persists — so "Save to disk" still emits a stock `.excalidraw` file.
- **Features should be expressed with existing element types.** Presentation mode is the model here: slides are ordinary frames, so a deck round-trips through upstream Excalidraw with no custom data at all. If a feature genuinely needs per-element metadata, use the upstream-sanctioned `customData` field — never a new top-level property.
- **New export formats are additive only.** PDF/PPTX export renders slides to images; it doesn't alter or replace the `.excalidraw` format.
- Before touching anything under `packages/excalidraw/data/` or `packages/element/src/types.ts`, stop and reconsider — that's the compatibility boundary. If a change there is truly unavoidable, it must round-trip: export from this fork → open on excalidraw.com → export again → open here.

## Project-wide conventions

These come from `AGENTS.md` and `.github/copilot-instructions.md` and apply repo-wide:

- For new DOM/browser API usage, use `app.ownerDocument`/`app.ownerWindow` instead of `window`/`document` globals; without an `app` in scope, derive them from the mounted node's `ownerDocument`/`defaultView` (supports embedding across multiple windows/iframes).
- When overriding properties of an existing type, prefer `Merge<Base, Overrides>` (from `@excalidraw/common/utility-types`) over `Omit<Base, keyof Overrides> & Overrides`.
- When writing math-related code, use the branded `Point` types from `packages/math/src/types.ts` (`GlobalPoint`/`LocalPoint`) instead of `{ x, y }` object literals, and check that file for the available geometry types (`Vector`, `Line`, `Curve`, `Rectangle`, etc.) before adding new ones.
- Prefer allocation-free, performant implementations where there's a choice — this codebase trades RAM for fewer CPU cycles on hot paths (rendering, geometry).
