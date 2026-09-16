/**
 * Multi-project workspace storage.
 *
 * Each project is a fully independent scene (elements + appState), stored
 * in IndexedDB (not localStorage, which has a much lower quota). Files
 * (images) are still shared across projects via `LocalData.fileStorage` —
 * files are content-addressed by `FileId`, so sharing the store is safe and
 * avoids duplicating image bytes per project.
 */
import { createStore, get, set, del } from "idb-keyval";

import { randomId } from "@excalidraw/common";

import type { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";

import {
  getElementsStorageSize,
  getTotalStorageSize,
  importLegacySceneFromLocalStorage,
} from "./localStorage";

export type ProjectMetadata = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

/** the subset of AppState that's safe/meaningful to persist, same shape the app already used for its single-scene localStorage save */
export type StorableAppState = ReturnType<typeof clearAppStateForLocalStorage>;

export type ProjectRecord = ProjectMetadata & {
  elements: ExcalidrawElement[];
  appState: StorableAppState;
};

/** currently open project, kept in sync so menu/dialog UI can react to it */
export const activeProjectAtom = atom<{ id: string; name: string } | null>(
  null,
);

const projectsStore = createStore(
  `${STORAGE_KEYS.IDB_PROJECTS}-db`,
  `${STORAGE_KEYS.IDB_PROJECTS}-store`,
);

const PROJECTS_INDEX_KEY = "projects-index";

const DEFAULT_PROJECT_NAME = "Untitled";
const MIGRATED_PROJECT_NAME = "My First Project";

export const getActiveProjectId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_PROJECT_ID);
  } catch (error: any) {
    console.error(error);
    return null;
  }
};

export const setActiveProjectId = (id: string) => {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_PROJECT_ID, id);
  } catch (error: any) {
    console.error(error);
  }
};

export class ProjectsStorage {
  private static async loadIndex(): Promise<ProjectMetadata[]> {
    const index = await get<ProjectMetadata[]>(
      PROJECTS_INDEX_KEY,
      projectsStore,
    );
    return index || [];
  }

  private static saveIndex(index: ProjectMetadata[]) {
    return set(PROJECTS_INDEX_KEY, index, projectsStore);
  }

  /** all projects, most-recently-updated first */
  static async listProjects(): Promise<ProjectMetadata[]> {
    const index = await this.loadIndex();
    return [...index].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  static async createProject(name: string): Promise<ProjectMetadata> {
    const now = Date.now();
    const meta: ProjectMetadata = {
      id: randomId(),
      name: name.trim() || DEFAULT_PROJECT_NAME,
      createdAt: now,
      updatedAt: now,
    };
    const record: ProjectRecord = { ...meta, elements: [], appState: {} };
    const index = await this.loadIndex();

    await Promise.all([
      set(meta.id, record, projectsStore),
      this.saveIndex([...index, meta]),
    ]);

    return meta;
  }

  static loadProject(id: string): Promise<ProjectRecord | undefined> {
    return get<ProjectRecord>(id, projectsStore);
  }

  /** persists the live scene into an existing project record */
  static async saveProjectScene(
    id: string,
    elements: readonly ExcalidrawElement[],
    appState: StorableAppState,
  ) {
    const record = await this.loadProject(id);
    if (!record) {
      return;
    }
    const updatedAt = Date.now();
    const updated: ProjectRecord = {
      ...record,
      elements: elements as ExcalidrawElement[],
      appState,
      updatedAt,
    };

    const index = await this.loadIndex();
    await Promise.all([
      set(id, updated, projectsStore),
      this.saveIndex(
        index.map((meta) => (meta.id === id ? { ...meta, updatedAt } : meta)),
      ),
    ]);
  }

  static async renameProject(id: string, name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }
    const record = await this.loadProject(id);
    if (!record) {
      return;
    }
    const updatedAt = Date.now();
    const updated: ProjectRecord = { ...record, name: trimmedName, updatedAt };

    const index = await this.loadIndex();
    await Promise.all([
      set(id, updated, projectsStore),
      this.saveIndex(
        index.map((meta) =>
          meta.id === id ? { ...meta, name: trimmedName, updatedAt } : meta,
        ),
      ),
    ]);
  }

  static async deleteProject(id: string) {
    const index = await this.loadIndex();
    await Promise.all([
      del(id, projectsStore),
      this.saveIndex(index.filter((meta) => meta.id !== id)),
    ]);
  }
}

/**
 * Resolves the project that should be shown on load: the last-active
 * project if it still exists, otherwise the most recently updated one. On a
 * brand new install (no projects yet), migrates the legacy single-scene
 * localStorage data (if any) into a first project so existing users don't
 * lose their canvas when this ships.
 */
export const ensureActiveProject = async (): Promise<ProjectRecord> => {
  const activeId = getActiveProjectId();
  if (activeId) {
    const existing = await ProjectsStorage.loadProject(activeId);
    if (existing) {
      return existing;
    }
  }

  const projects = await ProjectsStorage.listProjects();
  if (projects.length > 0) {
    setActiveProjectId(projects[0].id);
    return (await ProjectsStorage.loadProject(projects[0].id))!;
  }

  const legacyScene = importLegacySceneFromLocalStorage();
  const hasLegacyContent = legacyScene.elements.length > 0;
  const meta = await ProjectsStorage.createProject(
    hasLegacyContent ? MIGRATED_PROJECT_NAME : DEFAULT_PROJECT_NAME,
  );
  if (hasLegacyContent) {
    await ProjectsStorage.saveProjectScene(
      meta.id,
      legacyScene.elements,
      legacyScene.appState || {},
    );
  }
  setActiveProjectId(meta.id);
  return (await ProjectsStorage.loadProject(meta.id))!;
};

export const getActiveProjectStorageSize = async (): Promise<{
  scene: number;
  total: number;
}> => {
  const id = getActiveProjectId();
  if (!id) {
    return { scene: 0, total: 0 };
  }
  const record = await ProjectsStorage.loadProject(id);
  if (!record) {
    return { scene: 0, total: 0 };
  }
  return {
    scene: getElementsStorageSize(record.elements),
    total: getTotalStorageSize(record),
  };
};
