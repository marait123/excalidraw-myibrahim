import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";

export const saveUsernameToLocalStorage = (username: string) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLAB,
      JSON.stringify({ username }),
    );
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

export const importUsernameFromLocalStorage = (): string | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);
    if (data) {
      return JSON.parse(data).username;
    }
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  return null;
};

/**
 * Reads the pre-multi-project single-scene data out of its old localStorage
 * keys. Used exactly once, by `ensureActiveProject`, to migrate an existing
 * user's canvas into their first project. Do not use for anything else —
 * scene data now lives in IndexedDB, see `./projects`.
 */
export const importLegacySceneFromLocalStorage = () => {
  let savedElements = null;
  let savedState = null;

  try {
    savedElements = localStorage.getItem(
      STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_ELEMENTS,
    );
    savedState = localStorage.getItem(
      STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_APP_STATE,
    );
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  let elements: ExcalidrawElement[] = [];
  if (savedElements) {
    try {
      elements = JSON.parse(savedElements);
    } catch (error: any) {
      console.error(error);
      // Do nothing because elements array is already empty
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = {
        ...getDefaultAppState(),
        ...clearAppStateForLocalStorage(
          JSON.parse(savedState) as Partial<AppState>,
        ),
      };
    } catch (error: any) {
      console.error(error);
      // Do nothing because appState is already null
    }
  }
  return { elements, appState };
};

/** approximate serialized size (chars) of a project's elements, for display in stats */
export const getElementsStorageSize = (elements: unknown) => {
  try {
    return JSON.stringify(elements).length;
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};

/** approximate serialized size (chars) of a full project record, for display in stats */
export const getTotalStorageSize = (project: unknown) => {
  try {
    return JSON.stringify(project).length;
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};
