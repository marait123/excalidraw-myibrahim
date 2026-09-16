import { newFrameElement } from "@excalidraw/element";

import { getSlides } from "../presentation/slides";

const frame = (name: string, x: number, y: number, width = 400, height = 300) =>
  newFrameElement({ name, x, y, width, height });

describe("getSlides", () => {
  it("ignores non-frame and deleted elements", () => {
    const deleted = { ...frame("gone", 0, 0), isDeleted: true };
    const slides = getSlides([
      frame("a", 0, 0),
      deleted,
      { ...frame("rect", 0, 0), type: "rectangle" } as any,
    ]);
    expect(slides.map((slide) => slide.name)).toEqual(["a"]);
  });

  it("orders frames in reading order: rows top to bottom, left to right", () => {
    const slides = getSlides([
      frame("row2-right", 500, 400),
      frame("row1-right", 500, 0),
      frame("row2-left", 0, 400),
      frame("row1-left", 0, 0),
    ]);
    expect(slides.map((slide) => slide.name)).toEqual([
      "row1-left",
      "row1-right",
      "row2-left",
      "row2-right",
    ]);
  });

  it("treats slightly misaligned frames as the same row", () => {
    const slides = getSlides([
      frame("second", 500, 40), // nudged down, still overlaps the first frame
      frame("first", 0, 0),
      frame("third", 0, 350), // clearly below the row
    ]);
    expect(slides.map((slide) => slide.name)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
});
