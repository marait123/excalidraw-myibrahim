# CLAUDE.md — packages/common

Guidance for working in `@excalidraw/common`, the bottom-of-the-graph shared package. See also the root [CLAUDE.md](../../CLAUDE.md).

## Purpose

Cross-cutting constants, generic TypeScript utility types, and small framework-agnostic utilities used by every other package. This is the bottom of the dependency graph — it has no internal workspace dependencies (only external deps like `tinycolor2`), so nothing added here should ever need to import from `math`, `element`, `excalidraw`, or `utils`.

## Structure (`src/`)

| File | Responsibility |
| --- | --- |
| `constants.ts` | app-wide constants: `CURSOR_TYPE`, thresholds, `POINTER_BUTTON`, etc. |
| `colors.ts` | color palette/definitions |
| `keys.ts` | `KEYS`/`CODES` keyboard enums |
| `utility-types.ts` | generic TS helper types (see below) |
| `bounds.ts`, `points.ts` | small geometry-adjacent helpers not owned by `math` |
| `random.ts` | id/seed generation |
| `emitter.ts`, `appEventBus.ts` | pub-sub event bus |
| `binary-heap.ts`, `promise-pool.ts`, `queue.ts` | small generic data structures |
| `versionedSnapshotStore.ts` | generic versioned-snapshot storage helper |
| `editorInterface.ts` | platform detection |
| `font-metadata.ts`, `url.ts` | misc |

## Utility types

`utility-types.ts` defines `Merge<M, N> = Omit<M, keyof N> & N` — per `AGENTS.md`, prefer this over manually writing `Omit<Base, keyof Overrides> & Overrides` when overriding properties of an existing type. Also exports `Mutable<T>`, `ValueOf<T>`, `MarkOptional`/`MarkRequired`, `DTO<T>`, and `MakeBrand<T>` (the mechanism `packages/element` uses to create branded `Map` types like `ElementsMap` so a "subset" map can't be passed where a "full scene" map is expected).

## Boundary enforcement

Path alias `@excalidraw/common` → `packages/common/src/index.ts` (root `tsconfig.base.json`, mirrored in `vitest.config.mts`). Since every other internal package depends on this one, a change here has monorepo-wide blast radius — check usages across `packages/*` and `excalidraw-app/` before changing an existing export's signature or removing one.
