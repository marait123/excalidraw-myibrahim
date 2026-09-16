import { isFrameLikeElement } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";

export type Slide = ExcalidrawFrameLikeElement;

/**
 * Frames become slides, ordered the way you'd read a page: rows from top to
 * bottom, then left to right within a row. A frame joins the current row when
 * its vertical extent overlaps the row's by at least half of the shorter of
 * the two, so slightly misaligned frames still read as one row.
 */
export const getSlides = (elements: readonly ExcalidrawElement[]): Slide[] => {
  const frames = elements.filter(
    (element): element is Slide =>
      isFrameLikeElement(element) && !element.isDeleted,
  );

  const rows: { top: number; bottom: number; slides: Slide[] }[] = [];

  for (const frame of [...frames].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows[rows.length - 1];
    const frameBottom = frame.y + frame.height;

    if (row) {
      const overlap =
        Math.min(row.bottom, frameBottom) - Math.max(row.top, frame.y);
      const shorter = Math.min(row.bottom - row.top, frame.height);
      if (overlap >= shorter / 2) {
        row.slides.push(frame);
        row.top = Math.min(row.top, frame.y);
        row.bottom = Math.max(row.bottom, frameBottom);
        continue;
      }
    }

    rows.push({ top: frame.y, bottom: frameBottom, slides: [frame] });
  }

  return rows.flatMap((row) => row.slides.sort((a, b) => a.x - b.x));
};

/** cheap identity for "did the slide list change" checks */
export const getSlidesKey = (slides: readonly Slide[]) =>
  slides.map((slide) => `${slide.id}:${slide.version}`).join("|");
