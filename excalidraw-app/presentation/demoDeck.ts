import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";

/**
 * A small 16:9 three-slide deck used by the "Try a demo deck" button in
 * What's new. Built from stock frames + text, so it's an ordinary scene.
 *
 * Frame x/y are kept non-zero on purpose: the skeleton converter treats a
 * falsy coordinate as "compute from children".
 */
const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;
const SLIDE_GAP = 120;
const ORIGIN = 100;
const INSET = 60;

const slideX = (index: number) => ORIGIN + index * (SLIDE_WIDTH + SLIDE_GAP);

const text = (
  id: string,
  slide: number,
  y: number,
  value: string,
  fontSize: number,
  xOffset = 0,
): ExcalidrawElementSkeleton => ({
  type: "text",
  id,
  x: slideX(slide) + INSET + xOffset,
  y: ORIGIN + y,
  text: value,
  fontSize,
});

const frame = (
  index: number,
  name: string,
  children: string[],
): ExcalidrawElementSkeleton => ({
  type: "frame",
  x: slideX(index),
  y: ORIGIN,
  width: SLIDE_WIDTH,
  height: SLIDE_HEIGHT,
  name,
  children,
});

export const createDemoDeckElements = () =>
  convertToExcalidrawElements([
    // slide 1 — welcome
    {
      type: "rectangle",
      id: "demo-1-highlight",
      x: slideX(0) + INSET,
      y: ORIGIN + 262,
      width: 520,
      height: 16,
      backgroundColor: "#ffd43b",
      fillStyle: "solid",
      strokeColor: "transparent",
    },
    text("demo-1-title", 0, 190, "Presenting in Excalidraw", 56),
    text("demo-1-sub", 0, 310, "Every frame is a slide.", 32),
    text("demo-1-hint", 0, 440, "Press → or Space for the next slide", 24),
    frame(0, "Welcome", [
      "demo-1-highlight",
      "demo-1-title",
      "demo-1-sub",
      "demo-1-hint",
    ]),

    // slide 2 — controls
    text("demo-2-title", 1, 80, "Moving around", 48),
    text("demo-2-k1", 1, 200, "→  /  Space", 30),
    text("demo-2-d1", 1, 200, "next slide", 30, 300),
    text("demo-2-k2", 1, 260, "←", 30),
    text("demo-2-d2", 1, 260, "previous slide", 30, 300),
    text("demo-2-k3", 1, 320, "K", 30),
    text("demo-2-d3", 1, 320, "laser pointer", 30, 300),
    text("demo-2-k4", 1, 380, "Esc", 30),
    text("demo-2-d4", 1, 380, "stop presenting", 30, 300),
    frame(1, "Moving around", [
      "demo-2-title",
      "demo-2-k1",
      "demo-2-d1",
      "demo-2-k2",
      "demo-2-d2",
      "demo-2-k3",
      "demo-2-d3",
      "demo-2-k4",
      "demo-2-d4",
    ]),

    // slide 3 — make your own
    text("demo-3-title", 2, 80, "Make your own", 48),
    text("demo-3-s1", 2, 190, "1.  Draw frames with the Frame tool (F)", 28),
    text("demo-3-s2", 2, 245, "2.  Put anything inside a frame", 28),
    text("demo-3-s3", 2, 300, "3.  Menu → Present, or the Slides tab", 28),
    text("demo-3-s4", 2, 355, "4.  Export PDF / PPTX from the Slides tab", 28),
    text(
      "demo-3-note",
      2,
      450,
      "This demo is saved as a project — delete it any time in My Projects.",
      20,
    ),
    frame(2, "Your turn", [
      "demo-3-title",
      "demo-3-s1",
      "demo-3-s2",
      "demo-3-s3",
      "demo-3-s4",
      "demo-3-note",
    ]),
  ]);
