import clsx from "clsx";
import { useEffect, useState } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import {
  chevronLeftIcon,
  chevronRight,
  CloseIcon,
  LibraryIcon,
  playerPlayIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { KEYS } from "@excalidraw/common";

import { useAtom } from "../app-jotai";

import { whatsNewDialogAtom } from "./whatsNew";

import "./WhatsNewDialog.scss";

import type {
  WhatsNewActionType,
  WhatsNewItem,
  WhatsNewRelease,
} from "./releases";

const ACTION_ICONS: Record<WhatsNewActionType, React.ReactNode> = {
  openProjects: LibraryIcon,
  tryPresentation: playerPlayIcon,
  openSlides: presentationIcon,
};

/** the original Excalidraw's effective localStorage budget */
const ORIGINAL_LIMIT_BYTES = 5 * 1024 * 1024;

type View = { kind: "overview" } | { kind: "detail"; index: number };

type Entry = { item: WhatsNewItem; release: WhatsNewRelease };

const accentStyle = (accent: string) =>
  ({ "--accent": accent } as React.CSSProperties);

const formatBytes = (bytes: number) => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const rounded =
    value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[unit]}`;
};

/** "2026-09-18" -> "Sep 18, 2026" in the user's locale, without a UTC day shift */
const formatReleaseDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

/** live "before vs now" meter for the storage item, from the browser's quota */
const StorageUsage = () => {
  const { t } = useI18n();
  const [estimate, setEstimate] = useState<{
    usage: number;
    quota: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.storage
      ?.estimate?.()
      .then(({ usage, quota }) => {
        if (!cancelled && quota) {
          setEstimate({ usage: usage ?? 0, quota });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!estimate || estimate.quota <= ORIGINAL_LIMIT_BYTES) {
    return null;
  }

  // the old limit is a sliver next to the new quota — keep it visible
  const oldShare = Math.max(3, (ORIGINAL_LIMIT_BYTES / estimate.quota) * 100);

  return (
    <div className="WhatsNewDialog__storage">
      <div className="WhatsNewDialog__storageRow">
        <span className="WhatsNewDialog__storageLabel">
          {t("whatsNew.storageBefore")}
        </span>
        <span className="WhatsNewDialog__storageBar WhatsNewDialog__storageBar--old">
          <span style={{ width: `${oldShare}%` }} />
        </span>
        <span className="WhatsNewDialog__storageValue">~5 MB</span>
      </div>
      <div className="WhatsNewDialog__storageRow">
        <span className="WhatsNewDialog__storageLabel">
          {t("whatsNew.storageNow")}
        </span>
        <span className="WhatsNewDialog__storageBar">
          <span style={{ width: "100%" }} />
        </span>
        <span className="WhatsNewDialog__storageValue">
          {formatBytes(estimate.quota)}
        </span>
      </div>
      <p className="WhatsNewDialog__storageUsed">
        {t("whatsNew.storageUsed", { used: formatBytes(estimate.usage) })}
      </p>
    </div>
  );
};

const CloseButton = ({ onClick }: { onClick: () => void }) => {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="WhatsNewDialog__close"
      onClick={onClick}
      title={t("buttons.close")}
      aria-label={t("buttons.close")}
    >
      {CloseIcon}
    </button>
  );
};

const Overview = ({
  lead,
  releases,
  showDates,
  onOpen,
  onClose,
}: {
  lead: string;
  releases: readonly WhatsNewRelease[];
  showDates: boolean;
  onOpen: (index: number) => void;
  onClose: () => void;
}) => {
  const { t } = useI18n();
  let offset = 0;

  return (
    <div className="WhatsNewDialog__view">
      <header className="WhatsNewDialog__header">
        <span className="WhatsNewDialog__sparkle" aria-hidden="true">
          ✨
        </span>
        <div className="WhatsNewDialog__headerText">
          <h2 className="WhatsNewDialog__title">{t("whatsNew.title")}</h2>
          <p className="WhatsNewDialog__lead">{lead}</p>
        </div>
        <CloseButton onClick={onClose} />
      </header>

      {releases.map((release) => {
        const start = offset;
        offset += release.items.length;
        return (
          <section key={release.version} className="WhatsNewDialog__release">
            {showDates && (
              <h3 className="WhatsNewDialog__releaseDate">
                {formatReleaseDate(release.date)}
              </h3>
            )}
            <div className="WhatsNewDialog__grid">
              {release.items.map((item, i) => (
                <button
                  key={item.title}
                  type="button"
                  className="WhatsNewDialog__card"
                  style={accentStyle(item.accent)}
                  onClick={() => onOpen(start + i)}
                >
                  <span
                    className="WhatsNewDialog__cardEmoji"
                    aria-hidden="true"
                  >
                    {item.emoji}
                  </span>
                  <span className="WhatsNewDialog__cardText">
                    <span className="WhatsNewDialog__cardTitle">
                      {item.title}
                    </span>
                    <span className="WhatsNewDialog__cardTagline">
                      {item.tagline}
                    </span>
                  </span>
                  <span
                    className="WhatsNewDialog__cardChevron"
                    aria-hidden="true"
                  >
                    {chevronRight}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <footer className="WhatsNewDialog__footer">
        <p className="WhatsNewDialog__note">
          <span aria-hidden="true">🤝</span> {t("whatsNew.compatibilityNote")}
        </p>
        <div className="WhatsNewDialog__footerActions">
          <FilledButton
            size="large"
            variant="outlined"
            label={t("whatsNew.gotIt")}
            onClick={onClose}
          />
          <FilledButton
            size="large"
            label={t("whatsNew.tour")}
            icon={playerPlayIcon}
            onClick={() => onOpen(0)}
          />
        </div>
      </footer>
    </div>
  );
};

const Detail = ({
  entries,
  index,
  onNavigate,
  onBack,
  onClose,
  onAction,
}: {
  entries: readonly Entry[];
  index: number;
  onNavigate: (index: number) => void;
  onBack: () => void;
  onClose: () => void;
  onAction: (action: WhatsNewActionType) => void;
}) => {
  const { t } = useI18n();
  const { item } = entries[index];
  const isLast = index === entries.length - 1;
  const action = item.action;

  const next = () => (isLast ? onClose() : onNavigate(index + 1));

  return (
    <div
      className="WhatsNewDialog__view WhatsNewDialog__detail"
      // own the arrow keys so they don't also nudge elements on the canvas
      onKeyDown={(event) => {
        if (event.key === KEYS.ARROW_RIGHT && !isLast) {
          event.stopPropagation();
          onNavigate(index + 1);
        } else if (event.key === KEYS.ARROW_LEFT) {
          event.stopPropagation();
          if (index > 0) {
            onNavigate(index - 1);
          } else {
            onBack();
          }
        }
      }}
    >
      <div className="WhatsNewDialog__detailTop">
        <button type="button" className="WhatsNewDialog__back" onClick={onBack}>
          {chevronLeftIcon}
          {t("whatsNew.allUpdates")}
        </button>
        <span className="WhatsNewDialog__counter">
          {index + 1} / {entries.length}
        </span>
        <CloseButton onClick={onClose} />
      </div>

      <div
        key={index}
        className="WhatsNewDialog__detailBody"
        style={accentStyle(item.accent)}
      >
        <div className="WhatsNewDialog__hero">
          {item.image ? (
            <img
              src={item.image}
              alt=""
              className="WhatsNewDialog__heroImage"
            />
          ) : (
            <span className="WhatsNewDialog__heroEmoji" aria-hidden="true">
              {item.emoji}
            </span>
          )}
        </div>

        <h3 className="WhatsNewDialog__detailTitle">{item.title}</h3>
        <p className="WhatsNewDialog__detailDescription">{item.description}</p>

        {item.widget === "storageUsage" && <StorageUsage />}

        <ol className="WhatsNewDialog__steps">
          {item.howTo.map((step, i) => (
            <li key={step} className="WhatsNewDialog__step">
              <span className="WhatsNewDialog__stepNumber">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="WhatsNewDialog__detailActions">
        <div className="WhatsNewDialog__dots">
          {entries.map((entry, i) => (
            <button
              key={entry.item.title}
              type="button"
              className={clsx("WhatsNewDialog__dot", {
                "WhatsNewDialog__dot--active": i === index,
              })}
              aria-label={entry.item.title}
              aria-current={i === index ? "step" : undefined}
              onClick={() => onNavigate(i)}
            />
          ))}
        </div>
        <div className="WhatsNewDialog__detailButtons">
          {action ? (
            <>
              <FilledButton
                size="large"
                variant="outlined"
                label={isLast ? t("whatsNew.done") : t("whatsNew.next")}
                onClick={next}
              />
              <FilledButton
                size="large"
                icon={ACTION_ICONS[action.type]}
                label={action.label}
                onClick={() => {
                  onClose();
                  onAction(action.type);
                }}
              />
            </>
          ) : (
            <FilledButton
              size="large"
              label={isLast ? t("whatsNew.done") : t("whatsNew.next")}
              onClick={next}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Two levels: an overview of emoji cards (one-line taglines), and a detail
 * view per item with a hero, a short description, numbered steps and an
 * optional "show me" action that closes the popup and does the thing.
 */
export const WhatsNewDialog = ({
  onAction,
}: {
  onAction: (action: WhatsNewActionType) => void;
}) => {
  const { t } = useI18n();
  const [state, setState] = useAtom(whatsNewDialogAtom);
  const [view, setView] = useState<View>({ kind: "overview" });

  const isOpen = state.isOpen;
  useEffect(() => {
    // every (re)open starts from the overview
    if (isOpen) {
      setView({ kind: "overview" });
    }
  }, [isOpen]);

  if (!state.isOpen) {
    return null;
  }

  const close = () => setState({ isOpen: false });
  const entries: Entry[] = state.releases.flatMap((release) =>
    release.items.map((item) => ({ item, release })),
  );

  return (
    <Dialog
      size={720}
      title={false}
      onCloseRequest={close}
      className="WhatsNewDialog"
    >
      {view.kind === "overview" ? (
        <Overview
          lead={
            state.mode === "update"
              ? t("whatsNew.updateLead")
              : t("whatsNew.introLead")
          }
          releases={state.releases}
          showDates={state.releases.length > 1}
          onOpen={(index) => setView({ kind: "detail", index })}
          onClose={close}
        />
      ) : (
        <Detail
          entries={entries}
          index={Math.min(view.index, entries.length - 1)}
          onNavigate={(index) => setView({ kind: "detail", index })}
          onBack={() => setView({ kind: "overview" })}
          onClose={close}
          onAction={onAction}
        />
      )}
    </Dialog>
  );
};
