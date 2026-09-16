import { exportToCanvas } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import type { Slide } from "./slides";

/** render slides at 2x so they stay crisp when projected or zoomed */
const RENDER_SCALE = 2;

/** CSS pixels per inch — how PowerPoint maps our pixel sizes to its inches */
const PX_PER_INCH = 96;

/** PowerPoint refuses layouts larger than this */
const MAX_PPTX_INCHES = 56;

type RenderedSlide = {
  dataURL: string;
  /** logical (1x) size, in CSS px */
  width: number;
  height: number;
};

/**
 * Renders one frame to a PNG data URL. `exportingFrame` makes Excalidraw
 * clip to the frame and pick up exactly the elements overlapping it, so this
 * matches what the frame looks like while presenting.
 */
const renderSlide = async (
  excalidrawAPI: ExcalidrawImperativeAPI,
  slide: Slide,
): Promise<RenderedSlide> => {
  const { offsetTop, offsetLeft, ...appState } = excalidrawAPI.getAppState();

  const canvas = await exportToCanvas({
    elements: excalidrawAPI.getSceneElements(),
    appState: {
      ...appState,
      exportBackground: true,
      exportScale: RENDER_SCALE,
    },
    files: excalidrawAPI.getFiles(),
    exportingFrame: slide,
    exportPadding: 0,
    getDimensions: (width, height) => ({
      width: width * RENDER_SCALE,
      height: height * RENDER_SCALE,
      scale: RENDER_SCALE,
    }),
  });

  return {
    dataURL: canvas.toDataURL("image/png"),
    width: canvas.width / RENDER_SCALE,
    height: canvas.height / RENDER_SCALE,
  };
};

const renderSlides = async (
  excalidrawAPI: ExcalidrawImperativeAPI,
  slides: readonly Slide[],
) => {
  const rendered: RenderedSlide[] = [];
  for (const slide of slides) {
    // sequential on purpose: each render is canvas-heavy, and doing them in
    // parallel on a large deck can exhaust memory on weaker machines
    rendered.push(await renderSlide(excalidrawAPI, slide));
  }
  return rendered;
};

/** strips characters that browsers/OSes dislike in download filenames */
const toFileName = (name: string, extension: string) => {
  const base = name.trim().replace(/[\\/:*?"<>|]/g, "-") || "slides";
  return `${base}.${extension}`;
};

/**
 * One PDF page per slide, each page sized to its own frame, so a deck of
 * mixed frame sizes still exports without letterboxing or distortion.
 */
export const exportSlidesToPDF = async (
  excalidrawAPI: ExcalidrawImperativeAPI,
  slides: readonly Slide[],
  name: string,
) => {
  const [{ jsPDF }, rendered] = await Promise.all([
    import("jspdf"),
    renderSlides(excalidrawAPI, slides),
  ]);

  if (!rendered.length) {
    return;
  }

  const orientationOf = (slide: RenderedSlide) =>
    slide.width >= slide.height
      ? ("landscape" as const)
      : ("portrait" as const);

  const [first, ...rest] = rendered;

  const pdf = new jsPDF({
    orientation: orientationOf(first),
    unit: "px",
    format: [first.width, first.height],
    compress: true,
  });
  pdf.addImage(first.dataURL, "PNG", 0, 0, first.width, first.height);

  for (const slide of rest) {
    pdf.addPage([slide.width, slide.height], orientationOf(slide));
    pdf.addImage(slide.dataURL, "PNG", 0, 0, slide.width, slide.height);
  }

  pdf.save(toFileName(name, "pdf"));
};

/**
 * One PowerPoint slide per frame. A .pptx deck has a single slide size, so
 * the first frame defines it and any differently-shaped frame is centered
 * and scaled to fit rather than stretched.
 */
export const exportSlidesToPPTX = async (
  excalidrawAPI: ExcalidrawImperativeAPI,
  slides: readonly Slide[],
  name: string,
) => {
  const [{ default: PptxGenJS }, rendered] = await Promise.all([
    import("pptxgenjs"),
    renderSlides(excalidrawAPI, slides),
  ]);

  if (!rendered.length) {
    return;
  }

  const [first] = rendered;
  const scale = Math.min(
    1,
    (MAX_PPTX_INCHES * PX_PER_INCH) / Math.max(first.width, first.height),
  );
  const deckWidth = (first.width * scale) / PX_PER_INCH;
  const deckHeight = (first.height * scale) / PX_PER_INCH;

  const pptx = new PptxGenJS();
  pptx.defineLayout({
    name: "EXCALIDRAW_SLIDES",
    width: deckWidth,
    height: deckHeight,
  });
  pptx.layout = "EXCALIDRAW_SLIDES";

  for (const slide of rendered) {
    const fit = Math.min(
      deckWidth / (slide.width / PX_PER_INCH),
      deckHeight / (slide.height / PX_PER_INCH),
    );
    const width = (slide.width / PX_PER_INCH) * fit;
    const height = (slide.height / PX_PER_INCH) * fit;

    pptx.addSlide().addImage({
      data: slide.dataURL,
      x: (deckWidth - width) / 2,
      y: (deckHeight - height) / 2,
      w: width,
      h: height,
    });
  }

  await pptx.writeFile({ fileName: toFileName(name, "pptx") });
};
