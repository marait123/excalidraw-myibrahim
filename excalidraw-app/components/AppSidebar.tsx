import {
  DefaultSidebar,
  Sidebar,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import {
  playerPlayIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { getFrameLikeTitle } from "@excalidraw/element";
import clsx from "clsx";
import { useEffect, useState } from "react";

import { useAtomValue } from "../app-jotai";
import { getSlides, getSlidesKey } from "../presentation/slides";
import {
  presentationAPIAtom,
  presentationStateAtom,
} from "../presentation/usePresentation";

import "./AppSidebar.scss";

import type { Slide } from "../presentation/slides";

export const SLIDES_SIDEBAR_TAB = "slides";

/** frames in reading order, refreshed (at most once per frame) as the scene changes */
const useSlides = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const [slides, setSlides] = useState<Slide[]>([]);

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    let key = "";
    let frame = 0;

    const update = () => {
      const next = getSlides(excalidrawAPI.getSceneElements());
      const nextKey = getSlidesKey(next);
      if (nextKey !== key) {
        key = nextKey;
        setSlides(next);
      }
    };

    update();
    const unsubscribe = excalidrawAPI.onChange(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    });

    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, [excalidrawAPI]);

  return slides;
};

export const AppSidebar = () => {
  const { t } = useI18n();
  const { openSidebar } = useUIAppState();
  const slides = useSlides();
  const presentation = useAtomValue(presentationAPIAtom);
  const presentationState = useAtomValue(presentationStateAtom);
  const activeIndex = presentationState.active ? presentationState.index : -1;

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger
          tab={SLIDES_SIDEBAR_TAB}
          title={t("presentation.title")}
          style={{ opacity: openSidebar?.tab === SLIDES_SIDEBAR_TAB ? 1 : 0.4 }}
        >
          {presentationIcon}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab={SLIDES_SIDEBAR_TAB} className="AppSidebar__slides">
        <div className="AppSidebar__slidesActions">
          <FilledButton
            size="large"
            icon={playerPlayIcon}
            label={t("presentation.present")}
            disabled={!slides.length}
            onClick={() => presentation?.start(0)}
          />
        </div>
        {slides.length === 0 ? (
          <p className="AppSidebar__slidesEmpty">
            {t("presentation.noFrames")}
          </p>
        ) : (
          <>
            <p className="AppSidebar__slidesHint">
              {t("presentation.orderHint")}
            </p>
            <ol className="AppSidebar__slidesList">
              {slides.map((slide, index) => (
                <li key={slide.id}>
                  <button
                    type="button"
                    className={clsx("AppSidebar__slide", {
                      "AppSidebar__slide--active": index === activeIndex,
                    })}
                    onClick={() => {
                      if (presentationState.active) {
                        presentation?.goTo(index);
                      } else {
                        presentation?.showSlide(slide);
                      }
                    }}
                  >
                    <span className="AppSidebar__slideNumber">{index + 1}</span>
                    <span className="AppSidebar__slideTitle">
                      {getFrameLikeTitle(slide)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
