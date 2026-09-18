import { isRunningInIframe, isTestEnv } from "@excalidraw/common";

import { appJotaiStore, atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";

import { RELEASES } from "./releases";

import type { WhatsNewRelease } from "./releases";

export type WhatsNewDialogState =
  | { isOpen: false }
  | {
      isOpen: true;
      /**
       * `intro` — first visit, `update` — returning user with unseen releases,
       * `all` — opened manually from the menu / command palette
       */
      mode: "intro" | "update" | "all";
      releases: readonly WhatsNewRelease[];
    };

export const whatsNewDialogAtom = atom<WhatsNewDialogState>({ isOpen: false });

export const LATEST_WHATS_NEW_VERSION = RELEASES.reduce(
  (latest, release) => Math.max(latest, release.version),
  0,
);

/** delay after the scene loads, so the popup doesn't flash over a blank canvas */
const AUTO_OPEN_DELAY = 600;

const newestFirst = (releases: readonly WhatsNewRelease[]) =>
  [...releases].sort((a, b) => b.version - a.version);

export const getLastSeenWhatsNewVersion = (): number | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_WHATS_NEW_SEEN);
    if (raw === null) {
      return null;
    }
    const version = Number(raw);
    return Number.isFinite(version) ? version : null;
  } catch (error: any) {
    console.error(error);
    return null;
  }
};

export const markWhatsNewSeen = (version = LATEST_WHATS_NEW_VERSION) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_WHATS_NEW_SEEN,
      String(version),
    );
  } catch (error: any) {
    console.error(error);
  }
};

/** releases newer than `lastSeen`, newest first; all of them on a first visit */
export const getUnseenReleases = (
  releases: readonly WhatsNewRelease[],
  lastSeen: number | null,
) =>
  newestFirst(
    releases.filter(
      (release) => lastSeen === null || release.version > lastSeen,
    ),
  );

export const openWhatsNew = () => {
  appJotaiStore.set(whatsNewDialogAtom, {
    isOpen: true,
    mode: "all",
    releases: newestFirst(RELEASES),
  });
};

/**
 * Shows releases this browser hasn't seen yet, once. They're marked seen as
 * soon as the popup opens (not on close), so a reload never shows the same
 * release twice; the full changelog stays reachable from the menu.
 */
export const showUnseenWhatsNew = () => {
  if (isTestEnv() || isRunningInIframe()) {
    return;
  }
  const lastSeen = getLastSeenWhatsNewVersion();
  const unseen = getUnseenReleases(RELEASES, lastSeen);
  if (!unseen.length) {
    return;
  }
  markWhatsNewSeen();
  window.setTimeout(() => {
    appJotaiStore.set(whatsNewDialogAtom, {
      isOpen: true,
      mode: lastSeen === null ? "intro" : "update",
      releases: unseen,
    });
  }, AUTO_OPEN_DELAY);
};
