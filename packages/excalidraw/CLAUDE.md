# CLAUDE.md — packages/excalidraw

Guidance for working in `@excalidraw/excalidraw`, the main editor library. See also the root [CLAUDE.md](../../CLAUDE.md). Note: there is no `src/` subdirectory here — source lives directly under `packages/excalidraw/` (e.g. `packages/excalidraw/components/App.tsx`).

## Structure

```
packages/excalidraw/
├── index.tsx          public API entry — exports <Excalidraw>, actions, hooks, Sidebar/MainMenu/Footer, restore/serialize helpers
├── components/         all React UI, including the central App.tsx
├── actions/            command-pattern Action objects + ActionManager (manager.tsx, register.ts)
├── renderer/            canvas-drawing orchestration (staticScene.ts, interactiveScene.ts, animations)
├── scene/               Scene/Renderer glue, scrollbars, export-to-canvas, selection/normalize utilities
├── data/                persistence: localStorage, restore/reconcile, JSON (de)serialization, clipboard/library encode, ai/
├── hooks/, context/      small React hooks and app-state/tunnel contexts
├── fonts/, subset/        font loading and WOFF2 subsetting (harfbuzz wasm worker)
├── charts/, eraser/, lasso/, wysiwyg/   feature-specific logic (paste-as-chart, eraser, lasso selection, in-canvas text editor)
├── css/, locales/        styling and i18n JSON
└── tests/                Jest/RTL tests + shared test utilities
```

## Entry point and render tree

`index.tsx` defines `export const Excalidraw = React.memo(ExcalidrawBase, areEqual)` and re-exports the public API surface, including selected symbols re-exported straight from `@excalidraw/element` (e.g. `getTextFromElements`, `CaptureUpdateAction`). The render tree is:

```
<EditorJotaiProvider><InitializeApp><App .../></InitializeApp></EditorJotaiProvider>
```

The actual editor logic lives in the `App` class component in `components/App.tsx`.

## State management (mixed, deliberately layered)

- **`AppState`** (zoom, selection, active tool, UI flags — `types.ts:325`) is plain React class state on `App` (`class App extends React.Component<AppProps, AppState>`, `components/App.tsx:640`), threaded down via props/`AppContext`/`AppPropsContext`. It is defaulted/managed via `appState.ts`.
- **Element data** is _not_ React state. It's owned by a `Scene` instance (`this.scene = new Scene()`, `components/App.tsx:924`, class from `@excalidraw/element`) and mutated imperatively via `mutateElement`/`Scene` APIs, then captured into undo history (`history.ts`). Never update elements via `setState` — go through `@excalidraw/element`'s Scene APIs.
- **Jotai** (`editor-jotai.ts`, scoped via `jotai-scope`'s `createIsolation()`) holds smaller, cross-cutting UI state (color picker, dialogs, command palette, sidebar, TTD chat) so multiple `<Excalidraw>` instances on one page don't leak atoms into each other.
- `App.tsx` is the de facto center of the package (~14,000 lines): it owns `this.scene`, `this.renderer` (`scene/Renderer.ts`), `this.actionManager`, `this.fonts`, and virtually all pointer/keyboard/gesture handlers.

## Actions system

`actions/` implements a command pattern: each `actionXxx.tsx` defines an `Action` object (`name`, `perform`, optional `keyTest`, `PanelComponent`, `trackEvent`), registered via `register()` (`actions/register.ts`) and re-exported from `actions/index.ts`. `actions/manager.tsx`'s `ActionManager` (`registerAll`, `executeAction`, `handleKeyDown`) is instantiated once per `App` (`components/App.tsx:918`).

- Keyboard shortcuts: `App`'s `onKeyDown` → `this.actionManager.handleKeyDown(event)`.
- Toolbar/menu/context-menu UI calls `actionManager.executeAction(actionX, "ui" | "keyboard", value)` directly.

When adding a new user-triggerable operation, add an `Action` rather than wiring a one-off handler — shortcuts, undo/redo tracking, and analytics (`trackEvent`) all come for free.

## Rendering

`renderer/staticScene.ts` and `renderer/interactiveScene.ts` drive the two `<canvas>` layers (static content vs. interactive/selection overlay), orchestrated by `scene/Renderer.ts`/`scene/index.ts`. The low-level per-element drawing primitive (`renderElement`) actually lives in `packages/element/src/renderElement.ts` — this package's renderer imports it and handles scene-level concerns (frame clipping, dark-mode filters, embeddables, snapping guides), not raw shape drawing.

## Relationship to shared packages

- `@excalidraw/element` — element data model, mutation, binding, collision, the `Scene` class, low-level rendering. Source of truth for elements.
- `@excalidraw/common` — cross-cutting constants, keys, colors, small utils, event bus.
- `@excalidraw/math` — pure geometry, no DOM/React dependency.
- `@excalidraw/utils` — export/shape helpers usable outside the editor.

`package.json`'s `exports` map re-exposes `./element/*`, `./common/*`, `./math/*` type paths so consumers can deep-import types without reaching into node_modules internals directly.

## Testing

Tests live under `tests/*.test.tsx` (co-located per feature: `App.test.tsx`, `bucketFill.test.tsx`, `arrowBinding.test.tsx`), plus a few `*.test.ts(x)` directly in the package root (`clipboard.test.ts`, `charts.test.ts`, `mermaid.test.ts`). Shared helpers live in `tests/test-utils.ts` (custom `render`, `GlobalTestState`, `assertElements`, `checkpointHistory`, viewport mocking) plus `tests/helpers/`, `tests/queries/`, `tests/fixtures/`, `tests/data/`, `tests/scene/`, `tests/__snapshots__/`.

## Gotchas

- `Excalidraw` is wrapped in `React.memo(ExcalidrawBase, areEqual)` — a prop-equality bug in `areEqual` can silently block re-renders.
- `packages/excalidraw/README.md` has an "LLM / agent tips" section and a migration table for `0.18.x` deep-import path changes (old `types/`-prefixed paths → new `@excalidraw/excalidraw/element|data|common` subpaths) — check it before debugging integration issues in consuming apps.
- Multiple `<Excalidraw>` instances on one page are supported by design (scoped Jotai) — don't assume a singleton editor when touching global-looking state.
