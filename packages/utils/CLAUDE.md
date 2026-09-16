# CLAUDE.md — packages/utils

Guidance for working in `@excalidraw/utils`. See also the root [CLAUDE.md](../../CLAUDE.md).

## Purpose

Higher-level, optional convenience API for embedders (`@excalidraw/utils`) — export helpers and pure-shape geometry — distinct from `@excalidraw/common`'s low-level primitives. This is what an app embedding Excalidraw reaches for to export a scene to an image without pulling in the full editor UI.

## Structure (`src/`)

- `export.ts` — `exportToCanvas`/`exportToSvg`/`exportToBlob` wrappers.
- `shape.ts` — pure geometric shapes derived from elements/rough.js `Drawable`s, kept independent of rendering so collision/geometry logic can run without a canvas.
- `index.ts` — public exports.
- `test-utils.ts` — shared test helpers for this package.

## Important: this package is a bundle, not a peer

Unlike `element`/`math`/`common`, `utils` is not built with the "mark siblings external" convention. `src/export.ts` imports directly from `@excalidraw/excalidraw` (`appState`, `clipboard`, `data/json`, `scene/export`) even though `package.json` does **not** list `@excalidraw/excalidraw` as a dependency — this only resolves because the build (`scripts/buildUtils.js`) bundles `common`+`element`+`math`+`excalidraw` all inline. The other three packages build via `scripts/buildBase.js`, which marks those same sibling packages `external` instead.

Practical implication: if you add a new import from `@excalidraw/excalidraw` here, it will work in the monorepo (thanks to the `vitest.config.mts`/`tsconfig.base.json` path aliases) and in the bundled build, but don't assume the same import pattern is safe to copy into `element`, `math`, or `common` — it isn't, since those packages don't bundle their siblings.

## Boundary enforcement

Path alias `@excalidraw/utils` → `packages/utils/src/index.ts` (root `tsconfig.base.json`, mirrored in `vitest.config.mts`). Build via `yarn build:esm` → `scripts/buildUtils.js`, then `tsc` for `.d.ts` generation.
