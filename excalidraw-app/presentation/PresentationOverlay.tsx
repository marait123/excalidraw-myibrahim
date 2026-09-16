import {
  chevronLeftIcon,
  chevronRight,
  CloseIcon,
} from "@excalidraw/excalidraw/components/icons";
// plain `t`, not `useI18n`: this renders outside the <Excalidraw> tree, so the
// editor-scoped i18n provider isn't available here
import { t } from "@excalidraw/excalidraw/i18n";

import { useAtomValue } from "../app-jotai";

import { presentationAPIAtom, presentationStateAtom } from "./usePresentation";

import "./PresentationOverlay.scss";

export const PresentationOverlay = () => {
  const state = useAtomValue(presentationStateAtom);
  const presentation = useAtomValue(presentationAPIAtom);

  if (!state.active || !presentation) {
    return null;
  }

  return (
    <div
      className="PresentationOverlay"
      role="toolbar"
      aria-label={t("presentation.title")}
    >
      <button
        type="button"
        className="PresentationOverlay__button"
        onClick={presentation.prev}
        disabled={state.index === 0}
        title={t("presentation.previous")}
        aria-label={t("presentation.previous")}
      >
        {chevronLeftIcon}
      </button>
      <div className="PresentationOverlay__label">
        <span className="PresentationOverlay__counter">
          {state.index + 1} / {state.total}
        </span>
        <span className="PresentationOverlay__title" title={state.title}>
          {state.title}
        </span>
      </div>
      <button
        type="button"
        className="PresentationOverlay__button"
        onClick={presentation.next}
        disabled={state.index >= state.total - 1}
        title={t("presentation.next")}
        aria-label={t("presentation.next")}
      >
        {chevronRight}
      </button>
      <span className="PresentationOverlay__divider" />
      <button
        type="button"
        className="PresentationOverlay__button"
        onClick={presentation.exit}
        title={t("presentation.exit")}
        aria-label={t("presentation.exit")}
      >
        {CloseIcon}
      </button>
    </div>
  );
};
