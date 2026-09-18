import { useEffect } from "react";

import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { t } from "@excalidraw/excalidraw/i18n";
import { KEYS } from "@excalidraw/common";
import { getFrameLikeTitle } from "@excalidraw/element";

import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { atom, useSetAtom } from "../app-jotai";
import { LocalData } from "../data/LocalData";

import { getSlides, getSlidesKey } from "./slides";

import type { Slide } from "./slides";

export type PresentationState =
  | { active: false }
  | { active: true; index: number; total: number; title: string };

export const presentationStateAtom = atom<PresentationState>({
  active: false,
});

export type PresentationAPI = {
  /** enter presentation mode on the given slide (frames in reading order) */
  start: (index?: number) => void;
  exit: () => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  /** fit a frame in the viewport without entering presentation mode */
  showSlide: (slide: Slide) => void;
};

export const presentationAPIAtom = atom<PresentationAPI | null>(null);

/** room around a slide, in viewport px; extra at the bottom for the control bar */
const SLIDE_OFFSETS = { top: 32, right: 32, bottom: 88, left: 32 };

const RESIZE_REFIT_DELAY = 150;

type SavedViewState = Pick<
  AppState,
  | "viewModeEnabled"
  | "zenModeEnabled"
  | "scrollX"
  | "scrollY"
  | "zoom"
  | "frameRendering"
>;

const isEditableTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return (
    !!element &&
    (element.tagName === "INPUT" ||
      element.tagName === "TEXTAREA" ||
      element.isContentEditable)
  );
};

/**
 * Owns presentation mode for the app: frames are slides, presenting means
 * fullscreen + view mode + zen mode with one frame fitted at a time.
 * Publishes state via `presentationStateAtom` and controls via
 * `presentationAPIAtom` so the menu, sidebar and overlay stay decoupled.
 */
export const usePresentation = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) => {
  const setState = useSetAtom(presentationStateAtom);
  const setAPI = useSetAtom(presentationAPIAtom);

  useEffect(() => {
    if (!excalidrawAPI) {
      setAPI(null);
      return;
    }
    const api = excalidrawAPI;

    let active = false;
    let slides: Slide[] = [];
    let index = 0;
    let saved: SavedViewState | null = null;
    let enteredFullscreen = false;
    let resizeTimer = 0;

    const fitSlide = (slide: Slide, animate: boolean) => {
      api.setViewport({
        target: slide,
        fit: "contain",
        animation: animate,
        offsets: SLIDE_OFFSETS,
      });
    };

    const publish = () => {
      const slide = slides[index];
      setState(
        active && slide
          ? {
              active: true,
              index,
              total: slides.length,
              title: getFrameLikeTitle(slide),
            }
          : { active: false },
      );
    };

    const clampIndex = (value: number) =>
      Math.max(0, Math.min(value, slides.length - 1));

    const goTo = (value: number) => {
      if (!active || !slides.length) {
        return;
      }
      index = clampIndex(value);
      fitSlide(slides[index], true);
      publish();
    };

    const exit = () => {
      if (!active) {
        return;
      }
      active = false;

      if (enteredFullscreen && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      enteredFullscreen = false;

      if (saved) {
        api.updateScene({
          appState: {
            viewModeEnabled: saved.viewModeEnabled,
            zenModeEnabled: saved.zenModeEnabled,
            scrollX: saved.scrollX,
            scrollY: saved.scrollY,
            zoom: saved.zoom,
            frameRendering: saved.frameRendering,
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      } else {
        api.updateScene({
          appState: { viewModeEnabled: false, zenModeEnabled: false },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }
      saved = null;
      LocalData.resumeSave("presentation");
      publish();
    };

    const start = (startIndex = 0) => {
      const nextSlides = getSlides(api.getSceneElements());
      if (!nextSlides.length) {
        api.setToast({ message: t("presentation.noFrames"), duration: 5000 });
        return;
      }
      slides = nextSlides;

      if (active) {
        goTo(startIndex);
        return;
      }

      const appState = api.getAppState();
      saved = {
        viewModeEnabled: appState.viewModeEnabled,
        zenModeEnabled: appState.zenModeEnabled,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom,
        frameRendering: appState.frameRendering,
      };

      // make sure the last edits are persisted, then hold autosave so the
      // presentation-only view/zen state never gets written to the project
      LocalData.flushSave();
      LocalData.pauseSave("presentation");

      active = true;
      index = clampIndex(startIndex);

      api.updateScene({
        appState: {
          viewModeEnabled: true,
          zenModeEnabled: true,
          openSidebar: null,
          selectedElementIds: {},
          // a slide is its content: no frame name label or outline
          frameRendering: {
            ...appState.frameRendering,
            name: false,
            outline: false,
          },
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      const root = document.documentElement;
      if (root.requestFullscreen) {
        root
          .requestFullscreen()
          .then(() => {
            enteredFullscreen = true;
          })
          .catch(() => {});
      }

      fitSlide(slides[index], false);
      publish();
    };

    const next = () => goTo(index + 1);
    const prev = () => goTo(index - 1);

    const onKeyDown = (event: KeyboardEvent) => {
      if (!active || isEditableTarget(event.target)) {
        return;
      }
      switch (event.key) {
        case KEYS.ARROW_RIGHT:
        case KEYS.ARROW_DOWN:
        case KEYS.PAGE_DOWN:
        case KEYS.SPACE:
        case KEYS.ENTER:
          next();
          break;
        case KEYS.ARROW_LEFT:
        case KEYS.ARROW_UP:
        case KEYS.PAGE_UP:
        case KEYS.BACKSPACE:
          prev();
          break;
        case "Home":
          goTo(0);
          break;
        case "End":
          goTo(slides.length - 1);
          break;
        case KEYS.ESCAPE:
          exit();
          break;
        default:
          return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    const onFullscreenChange = () => {
      // the browser exits fullscreen on Esc without a keydown we can see
      if (active && enteredFullscreen && !document.fullscreenElement) {
        exit();
      }
    };

    const onResize = () => {
      if (!active) {
        return;
      }
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (active && slides[index]) {
          fitSlide(slides[index], false);
        }
      }, RESIZE_REFIT_DELAY);
    };

    const unsubscribeOnChange = api.onChange((elements) => {
      if (!active) {
        return;
      }
      const nextSlides = getSlides(elements);
      if (getSlidesKey(nextSlides) === getSlidesKey(slides)) {
        return;
      }
      slides = nextSlides;
      if (!slides.length) {
        exit();
        return;
      }
      index = clampIndex(index);
      publish();
    });

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    setAPI({
      start,
      exit,
      next,
      prev,
      goTo,
      showSlide: (slide) => {
        api.setViewport({
          target: slide,
          fit: "contain",
          animation: true,
          offsets: { ui: true },
        });
      },
    });

    return () => {
      exit();
      unsubscribeOnChange();
      window.clearTimeout(resizeTimer);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      setAPI(null);
    };
  }, [excalidrawAPI, setAPI, setState]);
};
