# CLAUDE.md — excalidraw-app

Guidance for working in `excalidraw-app/`, the excalidraw.com web app. See also the root [CLAUDE.md](../CLAUDE.md). This app consumes `@excalidraw/excalidraw` and adds everything the root README calls out as app-only, not (yet) part of the reusable npm package: real-time collaboration, end-to-end encryption, local-first autosave, multi-project workspace, PWA/offline support, and shareable links.

## Structure

```
excalidraw-app/
├── App.tsx              root app component — owns scene state, wiring, top-level logic
├── index.tsx            React entry point + service-worker registration
├── collab/               real-time collaboration client (socket transport, encryption, room portal)
├── data/                 persistence and data-transfer: per-project scene storage (IndexedDB), files/library (IndexedDB), Firebase (collab scene sync), backend export/import for shareable links
├── share/                "Share" dialog UI (collab invite + shareable link + QR code)
├── components/           app-shell UI: menu, footer, sidebar (Slides tab), welcome screen, AI panel, error boundary, ProjectsDialog
├── presentation/         Present mode (frames as slides) and PDF/PPTX slide export
├── whats-new/            the one-time "What's new" popup and its changelog data (releases.ts)
├── app-language/         i18n language detection/state for the app shell (separate from the library's own i18n)
├── tests/                Vitest specs for collab, language list, mobile menu, slides ordering, What's new changelog
├── app_constants.ts, app-jotai.ts, sentry.ts, useHandleAppTheme.ts
└── vite.config.mts
```

## Wiring the `<Excalidraw>` component

`index.tsx` mounts `ExcalidrawApp` (default export of `App.tsx`) into `#root`. The actual logic lives in `ExcalidrawWrapper` (`App.tsx:375`), which renders `<Excalidraw>`, passing `onChange`, `onExport`, `isCollaborating`, `UIOptions.canvasActions`, and `initialData={initialStatePromiseRef.current.promise}` — a `ResolvablePromise` fed by `initializeScene()`.

On mount, `ensureActiveProject()` (`data/projects.ts`) resolves which project to open — the last-active one (tracked via `STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_PROJECT_ID`, a small localStorage pointer), falling back to the most recently updated project, migrating a pre-multi-project user's legacy single-scene localStorage data into a first project on first run. Its result feeds `initializeScene()`'s `localDataState` param. From there, data flows in from, in priority order: URL hash (`#json=id,key` backend import, `#room=id,key` collab link, `#url=` external file), `?id=` query param, or the active project's persisted scene as the fallback. The imperative `excalidrawAPI` ref is captured via a callback ref and threaded to `Collab`, export, and debug-canvas code.

## Multi-project workspace

`data/projects.ts` is the multi-project scene store, layered on top of the same IndexedDB (`idb-keyval`) used elsewhere in this app:

- **`ProjectsStorage`** — CRUD for projects (`listProjects`, `createProject`, `loadProject`, `saveProjectScene`, `renameProject`, `deleteProject`). Each `ProjectRecord` holds `elements` + a `StorableAppState` (the same browser-persistable `AppState` subset `clearAppStateForLocalStorage` has always produced — not the full `AppState`, since fields like `width`/`height` are runtime-measured, not stored). A small `projects-index` key holds the lightweight `ProjectMetadata[]` list so the "My Projects" dialog doesn't need to load every project's full scene just to render a list.
- **`activeProjectAtom`** — the currently open project's `{id, name}`, read by `AppMainMenu` (shown in the menu, opens `ProjectsDialog`) and `ProjectsDialog` (to highlight the active row). `App.tsx` also keeps an `activeProjectIdRef` in sync with this atom so hot paths (`onChange` autosave, cross-tab `syncData`) always save/read against the _current_ project without a stale closure.
- **Switching projects** (`switchToProject` in `App.tsx`) flushes the outgoing project's pending autosave, loads the target project's record, calls `excalidrawAPI.updateScene(...)`, and clears undo history (`excalidrawAPI.history.clear()`) so undo can't cross project boundaries.
- Files/images are **not** duplicated per project — `LocalData.fileStorage` (content-addressed by `FileId`) is shared across all projects, same as before this feature.
- Cross-tab sync (`data/tabSync.ts`) is scoped to _this tab's_ `activeProjectIdRef`, not to whatever project another tab currently has active — two tabs open on the same project still sync; switching projects in one tab does not silently swap the scene showing in another.

## Presentation mode (frames as slides)

`presentation/` implements the slides feature (the open-source repo has no presentation code; Excalidraw+'s is closed source). Frames are the slides:

- **`slides.ts`** — `getSlides(elements)` returns non-deleted frame-like elements in reading order (rows top→bottom, then left→right; a frame joins a row when its vertical extent overlaps the row's by ≥ half the shorter one). Pure, unit-tested in `tests/slides.test.ts`.
- **`usePresentation.ts`** — the controller hook, mounted once in `App.tsx`. `start()` snapshots view/zen/scroll/zoom/`frameRendering`, hides frame names and outlines (a slide is just its content), flushes then pauses autosave (`LocalData.pauseSave("presentation")`, so the presenting-only `viewModeEnabled`/`zenModeEnabled` never reach the project record), switches to view+zen mode, requests fullscreen, and fits one frame at a time via `excalidrawAPI.setViewport({ target: frame, fit: "contain", offsets })`. Arrow/Space/PageUp/PageDown/Home/End navigate, Esc exits; a `fullscreenchange` listener exits when the browser leaves fullscreen on its own. Keys are handled in the capture phase on `window` and stopped so Excalidraw's global handler doesn't also act on them. State is published through `presentationStateAtom`; controls through `presentationAPIAtom`, consumed by the main menu, the command palette, the Slides sidebar tab, and the overlay.
- **`PresentationOverlay.tsx`** — the bottom-center control bar. It renders _outside_ `<Excalidraw>` (a sibling in `App.tsx`) so zen mode can't hide it; that's why it uses the plain `t()` function rather than `useI18n()` (the editor-scoped i18n provider doesn't exist outside the editor tree — the collab test catches this if it regresses). `PresentationOverlay.scss` also hides the menu button and zoom/undo controls that zen mode leaves visible, keyed off the `.excalidraw-app.is-presenting` class.
- **`demoDeck.ts`** — `createDemoDeckElements()` builds a three-slide sample deck from stock frames/text/rectangles via `convertToExcalidrawElements`; used by the What's new "Try a demo deck" action.
- **`components/AppSidebar.tsx`** — the "Slides" tab of the default sidebar: lists slides (subscribes to `excalidrawAPI.onChange`, refreshing at most once per animation frame), click to preview a frame or jump while presenting, plus a Present button.

### Slide export (PDF / PPTX)

`presentation/exportSlides.ts` renders each frame via `exportToCanvas({ exportingFrame })` (2x for crispness, clipped to the frame exactly like presenting) and then:

- **PDF** (`jspdf`) — one page per slide, each page sized to its own frame, so mixed frame sizes export without letterboxing.
- **PPTX** (`pptxgenjs`) — a `.pptx` has one deck-wide slide size, so the first frame defines it and any differently-shaped frame is centered and contain-fitted rather than stretched. Sizes convert at 96px/inch, clamped to PowerPoint's 56-inch maximum.

Both libraries are **dynamically imported** inside the export functions so they stay out of the main bundle, and rendering is sequential (canvas-heavy; parallel rendering of a large deck can exhaust memory). Triggered from the Slides sidebar tab. These are additive output formats — they don't touch the `.excalidraw` format (see the compatibility rule in the root [CLAUDE.md](../CLAUDE.md)).

## "What's new" popup

`whats-new/` shows users what this app adds on top of Excalidraw and what changed since their last visit. **Every user-facing change must add an entry to `whats-new/releases.ts`** — see "Keep What's new current" in the root [CLAUDE.md](../CLAUDE.md) for the rules.

- **`releases.ts`** — the changelog data: `RELEASES`, newest first, each `{ version, date, items: [{ emoji, accent, title, tagline, description, howTo[], action?, widget?, image? }] }` (field limits in the root CLAUDE.md). Plain data, no JSX; the release copy is English here rather than in the locale files so it can be updated alongside the feature. The dialog chrome (title, lead text, buttons, storage meter labels) _is_ translatable, under `whatsNew.*` in `packages/excalidraw/locales/en.json`.
- **`whatsNew.ts`** — the state: `whatsNewDialogAtom`, `openWhatsNew()` (full changelog, used by the main menu item and command palette), and `showUnseenWhatsNew()`, called from `App.tsx` once the initial scene has resolved (so it never stacks on top of a share-link confirm prompt). It reads the last-seen version from `STORAGE_KEYS.LOCAL_STORAGE_WHATS_NEW_SEEN` (localStorage — it's one small number), shows only newer releases (everything on a first visit), and **marks them seen as soon as the popup opens**, not on close, so each release appears exactly once per browser even if the user reloads mid-popup. It's skipped in tests and when embedded in an iframe.
- **`WhatsNewDialog.tsx`** — renders inside `<Excalidraw>` (it uses the editor's `Dialog` and `useI18n`, which need the editor context). Two levels: an **overview** grid of emoji cards (title + tagline, date headers only when several releases are shown), and a **detail** view per item — accent-tinted hero (the emoji floating, or `image`), description, optional `widget`, numbered steps, pagination dots, ←/→ to move between items, and the item's `action` button. Actions are reported through the `onAction` prop; `App.tsx`'s `onWhatsNewAction` maps them to real UI (`openProjects` → My Projects dialog, `openSlides` → Slides sidebar tab, `tryPresentation` → a new "Presentation demo" project seeded by `presentation/demoDeck.ts` and presented from slide 1). Lead text differs for a first visit (`intro`), a returning user (`update`), and a manual open (`all`). Animations respect `prefers-reduced-motion`.
- Deploys reach open tabs via the PWA's `registerType: "autoUpdate"`, so a new release's popup appears on the user's next load after a deploy.

There are no Excalidraw+ upsell surfaces left in this app (banner, sign-up links, promo sidebar tabs, export-to-Plus, the `/excalidraw-plus-export` route and the `excplus-*` cookie checks were all removed).

**Compatibility note:** everything this app adds (projects, presentation, slide export) lives in app-level storage or is expressed with stock element types — frames for slides, a plain elements array + `StorableAppState` per project. "Save to disk" still writes a stock `.excalidraw` file that opens on excalidraw.com, and vice versa. See the root [CLAUDE.md](../CLAUDE.md) for the full rule.

## Collaboration and encryption

- `collab/Collab.tsx` is a class-based collaboration controller (`CollabAPI`) instantiated inside `App.tsx`. Live sync transport is **socket.io-client**, connecting to `VITE_APP_WS_SERVER_URL` (a separate `excalidraw-room` server) — see `Collab.tsx:519-534`.
- **Firebase** (`data/firebase.ts`, Firestore + Storage, config via `VITE_APP_FIREBASE_CONFIG`) is the durable scene/file store for a collab room (`saveToFirebase`, `loadFromFirebase`, `saveFilesToFirebase`) — not the real-time transport. Sockets handle live cursor/element broadcast; Firebase persists room state so late joiners/reconnects can catch up.
- **End-to-end encryption**: `collab/Portal.tsx` encrypts outgoing payloads; `Collab.tsx:458` (`decryptPayload`) decrypts incoming ones, using `encryptData`/`decryptData` from `@excalidraw/excalidraw/data/encryption` (AES-GCM via WebCrypto). The room key never leaves the URL fragment (`#room=id,key`), so neither the socket server nor Firebase ever see plaintext. The same primitives are reused in `data/firebase.ts` (encrypt/decrypt before storing) and `data/index.ts` (shareable-link export/import). `components/EncryptedIcon.tsx` shows the lock indicator in the UI.

## Persistence/storage

Local-first autosave is deliberately split across two mechanisms in `data/` (see header comment in `data/LocalData.ts` for the rationale):

- **localStorage** (`data/localStorage.ts`) — appState and elements JSON (`STORAGE_KEYS.LOCAL_STORAGE_*`), plus collab username.
- **IndexedDB via `idb-keyval`** (`data/LocalData.ts`, debounced by `SAVE_TO_LOCAL_STORAGE_TIMEOUT`) — binary files and library data, with `FileManager`/`Locker`/`fileStatusStore` managing lifecycle and stale-file GC.
- `data/tabSync.ts` guards against cross-tab overwrites via `isBrowserStorageStateNewer`.
- Collab room state is never clobbered by local autosave: `initializeScene` explicitly skips the overwrite-confirm prompt when `roomLinkData` is present.

## PWA / service worker

Configured via `VitePWA` (`vite-plugin-pwa`) in `vite.config.mts` — there is no hand-written service worker file; Workbox generates it at build time. Config includes `registerType: "autoUpdate"`, custom `workbox.runtimeCaching` (fonts CacheFirst, locale chunks CacheFirst, fonts.css StaleWhileRevalidate), a `manifest` (icons, `file_handlers` for `.excalidraw`, `share_target`), and `devOptions.enabled` gated by `VITE_APP_ENABLE_PWA`. `index.tsx` calls `registerSW()` from `virtual:pwa-register`.

## Shareable links

`data/index.ts`: `exportToBackend()` generates a fresh AES key (`generateEncryptionKey`), encrypts the scene, POSTs to `VITE_APP_BACKEND_V2_POST_URL`, and builds `#json=<id>,<key>`; `importFromBackend()`/`legacy_decodeFromBackend` reverse it. Invoked from `App.tsx`'s `onExportToBackend` (~line 780), surfaced via `ShareableLinkDialog` and `share/ShareDialog.tsx` (which also handles collab room links + QR via `share/QRCode.tsx`).

## Environment variables

No `.env.example` — real defaults live in root **`.env.development`** and **`.env.production`** (checked in, with dev/prod Firebase configs). Local secrets/overrides go in `.env.local` (gitignored). Key vars: `VITE_APP_BACKEND_V2_{GET,POST}_URL`, `VITE_APP_WS_SERVER_URL`, `VITE_APP_FIREBASE_CONFIG`, `VITE_APP_LIBRARY_*`, `VITE_APP_AI_BACKEND`, `VITE_APP_PLUS_{LP,APP}`, `VITE_APP_PLUS_EXPORT_PUBLIC_KEY`, `VITE_APP_PORT`, `VITE_APP_ENABLE_PWA/ESLINT/TRACKING`.

## Build/deploy

`vite.config.mts` aliases `@excalidraw/*` packages to their `packages/*/src`, has custom `manualChunks` (locale files, mermaid, codemirror split out), `woff2BrowserPlugin`, `vite-plugin-svgr`, `vite-plugin-ejs`/`vite-plugin-html`, `vite-plugin-checker` (TS+ESLint overlay), `vite-plugin-sitemap`, `publicDir: "../public"`. Scripts: `build:app` (sets `VITE_APP_GIT_SHA`/tracking), `build:app:docker` (disables Sentry), `build` = `build:app` + `build:version`. Root **`Dockerfile`** multi-stage builds via `yarn build:app:docker`, then serves `excalidraw-app/build` from nginx. Root **`vercel.json`** sets `outputDirectory: excalidraw-app/build`, CORS/security headers, and legacy redirects.

## Testing

Vitest specs under `tests/` reuse the library's own test helpers (`@excalidraw/excalidraw/tests/helpers/api`, `test-utils`) — e.g. `collab.test.tsx` renders `ExcalidrawApp` directly and mocks `window.crypto`/sockets to test collab flows. `LanguageList.test.tsx` and `MobileMenu.test.tsx` cover app-shell components. Snapshots in `tests/__snapshots__`.
