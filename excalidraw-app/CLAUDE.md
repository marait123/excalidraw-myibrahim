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
├── components/           app-shell UI: menu, footer, sidebar, welcome screen, AI panel, promo banners, error boundary, ProjectsDialog
├── app-language/         i18n language detection/state for the app shell (separate from the library's own i18n)
├── tests/                Vitest specs for collab, language list, mobile menu
├── app_constants.ts, app-jotai.ts, sentry.ts, useHandleAppTheme.ts
└── vite.config.mts
```

## Wiring the `<Excalidraw>` component

`index.tsx` mounts `ExcalidrawApp` (default export of `App.tsx`) into `#root`. The actual logic lives in `ExcalidrawWrapper` (`App.tsx:375`), which renders `<Excalidraw>`, passing `onChange`, `onExport`, `isCollaborating`, `UIOptions.canvasActions`, and `initialData={initialStatePromiseRef.current.promise}` — a `ResolvablePromise` fed by `initializeScene()`.

On mount, `ensureActiveProject()` (`data/projects.ts`) resolves which project to open — the last-active one (tracked via `STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_PROJECT_ID`, a small localStorage pointer), falling back to the most recently updated project, migrating a pre-multi-project user's legacy single-scene localStorage data into a first project on first run. Its result feeds `initializeScene()`'s `localDataState` param. From there, data flows in from, in priority order: URL hash (`#json=id,key` backend import, `#room=id,key` collab link, `#url=` external file), `?id=` query param, or the active project's persisted scene as the fallback. The imperative `excalidrawAPI` ref is captured via a callback ref and threaded to `Collab`, export, and debug-canvas code.

## Multi-project workspace

`data/projects.ts` is the multi-project scene store, layered on top of the same IndexedDB (`idb-keyval`) used elsewhere in this app:

- **`ProjectsStorage`** — CRUD for projects (`listProjects`, `createProject`, `loadProject`, `saveProjectScene`, `renameProject`, `deleteProject`). Each `ProjectRecord` holds `elements` + a `StorableAppState` (the same browser-persistable `AppState` subset `clearAppStateForLocalStorage` has always produced — not the full `AppState`, since fields like `width`/`height` are runtime-measured, not stored). A small `projects-index` key holds the lightweight `ProjectMetadata[]` list so the "My Projects" dialog doesn't need to load every project's full scene just to render a list.
- **`activeProjectAtom`** — the currently open project's `{id, name}`, read by `AppMainMenu` (shown in the menu, opens `ProjectsDialog`) and `ProjectsDialog` (to highlight the active row). `App.tsx` also keeps an `activeProjectIdRef` in sync with this atom so hot paths (`onChange` autosave, cross-tab `syncData`) always save/read against the *current* project without a stale closure.
- **Switching projects** (`switchToProject` in `App.tsx`) flushes the outgoing project's pending autosave, loads the target project's record, calls `excalidrawAPI.updateScene(...)`, and clears undo history (`excalidrawAPI.history.clear()`) so undo can't cross project boundaries.
- Files/images are **not** duplicated per project — `LocalData.fileStorage` (content-addressed by `FileId`) is shared across all projects, same as before this feature.
- Cross-tab sync (`data/tabSync.ts`) is scoped to *this tab's* `activeProjectIdRef`, not to whatever project another tab currently has active — two tabs open on the same project still sync; switching projects in one tab does not silently swap the scene showing in another.

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
