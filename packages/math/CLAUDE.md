# CLAUDE.md — packages/math

Guidance for working in `@excalidraw/math`, the shared geometry package. See also the root [CLAUDE.md](../../CLAUDE.md).

## Purpose

Pure 2D geometry primitives (points, vectors, lines, curves, angles, shapes) shared by `element`, the editor, and `utils`. No DOM or React dependency — every function here should stay a pure, framework-agnostic function.

## Structure (`src/`)

`types.ts`, `point.ts`, `vector.ts`, `line.ts`/`segment.ts`, `curve.ts`, `angle.ts`, `rectangle.ts`, `polygon.ts`, `triangle.ts`, `ellipse.ts`, `range.ts`, `pca.ts`, `constants.ts`, `utils.ts`; `index.ts` re-exports all of the above.

## Always check `types.ts` before writing math code

Per project convention (`.github/copilot-instructions.md`), always include `packages/math/src/types.ts` in context when writing math-related code, and use its branded types instead of `{ x, y }` object literals. It defines:

- **`GlobalPoint` / `LocalPoint`** — branded `[x, y]` tuples (not objects) that prevent mixing coordinate spaces. There is no single generic `Point` type — "the Point type" referenced in project conventions means `GlobalPoint | LocalPoint`, constructed generically via `pointFrom<Point>()` in `point.ts`.
- **`Vector`** — a direction/magnitude tuple, distinct from a point.
- **`Line<P>` / `LineSegment<P>`**, **`Triangle<P>` / `Rectangle<P>` / `Polygon<P>`** (arrays of points), **`Curve<P>`** (4-point cubic bezier), **`Ellipse<P>`** (center + halfWidth + halfHeight).
- **`Radians` / `Degrees`** — branded numbers, so an angle in the wrong unit is a type error, not a runtime bug.
- **`PolarCoords`**, **`ElementsSegmentsMap`**.

## Style

Functions are pure/free functions (no classes), and tuple/array point types are an intentional perf choice over object literals — consistent with the project-wide preference for allocation-conscious, performant implementations (`.github/copilot-instructions.md`). When adding a new geometry helper, check whether an equivalent already exists in one of the files above before writing a new one — this package is small enough that duplication is easy to spot and easy to avoid.

## Boundary enforcement

Path alias `@excalidraw/math` → `packages/math/src/index.ts` (root `tsconfig.base.json`, mirrored in `vitest.config.mts`). `package.json` declares a dependency on `common` only — nothing in this package should import from `element`, `excalidraw`, or `utils`.
