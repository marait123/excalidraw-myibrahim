import { RELEASES } from "../whats-new/releases";
import {
  getUnseenReleases,
  LATEST_WHATS_NEW_VERSION,
} from "../whats-new/whatsNew";

import type {
  WhatsNewActionType,
  WhatsNewRelease,
} from "../whats-new/releases";

const release = (version: number): WhatsNewRelease => ({
  version,
  date: "2026-01-01",
  items: [
    {
      emoji: "✨",
      accent: "#6965db",
      title: `v${version}`,
      tagline: "t",
      description: "d",
      howTo: ["step"],
    },
  ],
});

describe("getUnseenReleases", () => {
  const releases = [release(1), release(3), release(2)];

  it("shows everything, newest first, on a first visit", () => {
    expect(getUnseenReleases(releases, null).map((r) => r.version)).toEqual([
      3, 2, 1,
    ]);
  });

  it("shows only releases newer than the last one seen", () => {
    expect(getUnseenReleases(releases, 1).map((r) => r.version)).toEqual([
      3, 2,
    ]);
  });

  it("shows nothing once the latest release has been seen", () => {
    expect(getUnseenReleases(releases, 3)).toEqual([]);
  });
});

// guards the rules in the root CLAUDE.md ("Keep What's new current"):
// a malformed entry would silently hide a release, and long copy turns the
// popup back into an article
describe("RELEASES changelog", () => {
  const ACTIONS: readonly WhatsNewActionType[] = [
    "openProjects",
    "tryPresentation",
    "openSlides",
  ];

  it("has at least one release", () => {
    expect(RELEASES.length).toBeGreaterThan(0);
  });

  it("lists releases newest first with unique, increasing integer versions", () => {
    RELEASES.forEach((entry, index) => {
      expect(Number.isInteger(entry.version)).toBe(true);
      expect(entry.version).toBeGreaterThan(0);
      if (index > 0) {
        expect(entry.version).toBeLessThan(RELEASES[index - 1].version);
      }
    });
    expect(LATEST_WHATS_NEW_VERSION).toBe(RELEASES[0].version);
  });

  it("uses valid YYYY-MM-DD dates that never go backwards", () => {
    RELEASES.forEach((entry, index) => {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(entry.date))).toBe(false);
      if (index > 0) {
        // newest first, so each release is on or before the one above it
        expect(entry.date <= RELEASES[index - 1].date).toBe(true);
      }
    });
  });

  it("keeps every item short and scannable", () => {
    // collected rather than asserted one by one, so a failure lists every
    // problem across the whole changelog at once
    const problems: string[] = [];
    const check = (ok: boolean, message: string) => {
      if (!ok) {
        problems.push(message);
      }
    };

    for (const entry of RELEASES) {
      check(entry.items.length > 0, `release ${entry.version} has no items`);
      for (const item of entry.items) {
        const at = `v${entry.version} "${item.title}"`;
        check(!!item.emoji.trim(), `${at}: missing emoji`);
        check(
          /^#[0-9a-f]{6}$/i.test(item.accent),
          `${at}: accent must be #rrggbb`,
        );
        check(
          item.title.length > 0 && item.title.length <= 40,
          `${at}: title must be 1–40 chars`,
        );
        check(
          item.tagline.length > 0 && item.tagline.length <= 60,
          `${at}: tagline must be 1–60 chars`,
        );
        check(
          item.description.length > 0 && item.description.length <= 220,
          `${at}: description must be 1–220 chars`,
        );
        check(
          item.howTo.length > 0 && item.howTo.length <= 4,
          `${at}: needs 1–4 howTo steps`,
        );
        item.howTo.forEach((step, i) =>
          check(
            !!step.trim() && step.length <= 80,
            `${at}: step ${i + 1} must be 1–80 chars`,
          ),
        );
        if (item.action) {
          check(
            ACTIONS.includes(item.action.type),
            `${at}: unknown action "${item.action.type}"`,
          );
          check(
            item.action.label.length <= 30,
            `${at}: action label must be ≤ 30 chars`,
          );
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("uses unique item titles (they key the cards)", () => {
    const titles = RELEASES.flatMap((entry) =>
      entry.items.map((item) => item.title),
    );
    expect(new Set(titles).size).toBe(titles.length);
  });
});
