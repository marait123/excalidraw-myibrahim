/**
 * The "What's new" changelog shown to users.
 *
 * Every user-facing change ships with an entry here (see "Keep What's new
 * current" in the root CLAUDE.md). Each release pops up exactly once per
 * browser, so:
 *
 * - add new releases at the TOP, with `version` = previous version + 1
 * - never edit a shipped release to announce something new — returning users
 *   have already seen it and won't be shown it again; add a new release
 * - keep it scannable: the overview only shows emoji + title + tagline, and
 *   the detail view is a hero, one or two sentences and a few short steps.
 *   Length limits are enforced by `tests/whatsNew.test.ts`.
 */

/** "show me" buttons in the detail view; handled by `onWhatsNewAction` in App.tsx */
export type WhatsNewActionType =
  | "openProjects"
  | "tryPresentation"
  | "openSlides";

/** optional live widget rendered in the detail view */
export type WhatsNewWidget = "storageUsage";

export type WhatsNewItem = {
  /** big emoji for the card and the hero */
  emoji: string;
  /** hero/card accent color, as #rrggbb */
  accent: string;
  /** ≤ 40 chars */
  title: string;
  /** one line for the overview card, ≤ 60 chars */
  tagline: string;
  /** one or two sentences for the detail view, ≤ 220 chars */
  description: string;
  /** 1–4 short steps, ≤ 80 chars each; name the real UI (menu labels, shortcuts) */
  howTo: readonly string[];
  action?: { type: WhatsNewActionType; label: string };
  widget?: WhatsNewWidget;
  /** optional screenshot/GIF for the hero, served from `public/` (e.g. "/whats-new/present.gif") */
  image?: string;
};

export type WhatsNewRelease = {
  /** strictly increasing integer, +1 per release */
  version: number;
  /** YYYY-MM-DD the release shipped */
  date: string;
  items: readonly WhatsNewItem[];
};

export const RELEASES: readonly WhatsNewRelease[] = [
  {
    version: 1,
    date: "2026-09-18",
    items: [
      {
        emoji: "💾",
        accent: "#12b886",
        title: "Much bigger drawings",
        tagline: "No more ~5 MB browser storage limit",
        description:
          "Drawings are saved in IndexedDB instead of localStorage, so big canvases full of images keep saving. Live-collab rooms keep the original limit.",
        howTo: [
          "Nothing to do — it's automatic",
          "Your old canvas moved over on first launch",
        ],
        widget: "storageUsage",
      },
      {
        emoji: "🗂️",
        accent: "#6965db",
        title: "Multiple projects",
        tagline: "Separate drawings, one click to switch",
        description:
          "Each project saves on its own, and the app reopens the one you used last.",
        howTo: [
          "Menu ☰ → My Projects",
          "New project starts a fresh canvas",
          "Click a project to switch to it",
          "✏️ to rename, 🗑️ twice to delete",
        ],
        action: { type: "openProjects", label: "Open My Projects" },
      },
      {
        emoji: "🎬",
        accent: "#f08c00",
        title: "Present as slides",
        tagline: "Every frame becomes a full-screen slide",
        description:
          "Frames play in reading order — top to bottom, then left to right. The laser pointer works while you present.",
        howTo: [
          "Draw frames with the Frame tool (F)",
          "Menu ☰ → Present",
          "← → or Space to move, Esc to stop",
          "Press K for the laser pointer",
        ],
        action: { type: "tryPresentation", label: "Try a demo deck" },
      },
      {
        emoji: "📤",
        accent: "#ae3ec9",
        title: "PDF & PowerPoint export",
        tagline: "Share your slides as .pdf or .pptx",
        description:
          "One page (PDF) or one slide (PowerPoint) per frame. PowerPoint slides are images, so they aren't editable shapes.",
        howTo: [
          "Open the sidebar → Slides tab",
          "Click Export PDF or Export PPTX",
        ],
        action: { type: "openSlides", label: "Open the Slides tab" },
      },
    ],
  },
];
