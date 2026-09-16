# CLAUDE.md — packages/element

Guidance for working in `@excalidraw/element`, the shared element data model. See also the root [CLAUDE.md](../../CLAUDE.md).

## Purpose

Owns the `ExcalidrawElement` data model and all logic that creates, mutates, binds, resizes, and orders elements on the canvas — the domain layer shared between the editor UI (`packages/excalidraw`) and serialization/collab code (`excalidraw-app`).

## Structure (`src/`)

| File | Responsibility |
| --- | --- |
| `types.ts` | element type hierarchy |
| `newElement.ts` | element factories |
| `mutateElement.ts` | in-place element updates |
| `Scene.ts` | element registry/query API |
| `store.ts` | undo/history capture (`Store`, `CaptureUpdateAction`) |
| `delta.ts` | diffing snapshots for history/collab (`ElementsDelta`) |
| `binding.ts`, `elbowArrow.ts`, `linearElementEditor.ts` | arrow-to-shape binding |
| `fractionalIndex.ts`, `zindex.ts`, `sortElements.ts` | z-ordering |
| `collision.ts`, `distance.ts`, `bounds.ts`, `resizeTest.ts` | hit-testing/geometry |
| `shape.ts` | rough.js shape cache |
| `groups.ts`, `frame.ts` | grouping and frames |
| `textElement.ts`, `textWrapping.ts` | text layout |
| `renderElement.ts` | low-level per-element canvas drawing |
| `duplicate.ts` | copy/paste and duplication |

## The element model

`ExcalidrawElement` (`types.ts:223`) is a discriminated union (rectangle, diamond, text, linear, arrow, freedraw, image, frame, iframe, embeddable) over a shared readonly `_ExcalidrawElementBase` (`types.ts:40`) carrying `id`, geometry, `version`/`versionNonce`/`updated` (collab reconciliation), `index: FractionalIndex | null` (ordering), `groupIds`, `frameId`, `boundElements`, `customData`.

Wrapper types compose via intersection rather than separate classes:

- `Ordered<T>` — has a resolved `index`.
- `NonDeleted<T>` — `isDeleted: false`.

Elements are stored in `ElementsMap`/`SceneElementsMap`/`NonDeletedSceneElementsMap` (`types.ts:448-486`) — all `Map<id, element>`, but branded to prevent accidentally mixing a "subset" map with a "full scene" map. `Scene.ts` wraps one such map and exposes the query/subscribe methods the app relies on.

## Mutable vs. immutable update paths

- **`mutateElement()`** (`mutateElement.ts:40`) mutates an element object in place and bumps `version`/`versionNonce`/`updated`. This is the low-level primitive — prefer going through `scene.mutateElement` from the app rather than calling it directly, since it does _not_ trigger a React re-render on its own.
- **`newElementWith()`** returns a new object (immutable path), used by the undo `Store` since `ElementsDelta` (`delta.ts`) diffs before/after snapshots.
- **`bumpVersion()`** mutates only version metadata, without touching geometry/content.

## Binding, ordering, and sync

- **Binding**: `binding.ts` + `elbowArrow.ts` implement geometric binding of arrows to shapes (`startBinding`/`endBinding` fields, `BindMode`), recalculating attachment points via an `ElementsMap`.
- **Ordering**: `FractionalIndex` (a fractional-indexing string, from the sibling `@excalidraw/fractional-indexing` package) plus `syncInvalidIndices`/`syncMovedIndices` keep array order consistent across peers without needing to reindex the whole array on every move.
- **Sync/versioning**: `version`/`versionNonce` per element, plus `hashElementsVersion`/`getSceneVersion` (`index.ts`), support last-write-wins reconciliation across collaborating clients. This is separate from `store.ts`'s local undo/redo capture — network sync and local history are two different mechanisms operating on the same element data.

## Boundary enforcement

Path alias `@excalidraw/element` → `packages/element/src/index.ts`, defined in root `tsconfig.base.json` and mirrored in `vitest.config.mts`. `package.json` declares this package depends on `common` and `math` only (no dependency on `packages/excalidraw`), enforcing the one-way dependency graph — don't import from `@excalidraw/excalidraw` here even if it would be convenient.
