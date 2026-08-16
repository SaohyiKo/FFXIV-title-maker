import { LOCAL_CHINESE_FONT_FAMILY } from "./font";
import type {
  ActiveLanguage,
  ExportFormat,
  LanguagePreset,
  RenderResult,
  TitleConfig,
} from "./types";
import {
  assertSafeCanvasSize,
  isChineseGrapheme,
  resolveLanguage,
  splitGraphemes,
} from "./utils";

const HIGHLIGHT_COLOR = "#f7f7eb";
const SHADOW_COLOR = "#644824";
const INNER_GLOW_COLOR = "#f2d99b";
const OUTER_GLOW_COLOR = "#7d7762";
const OUTER_GLOW_SIZE = 24;
const BEVEL_SIZE = 5;

interface GlyphMetric {
  grapheme: string;
  advance: number;
}

interface RunMetric {
  glyphs: GlyphMetric[];
  width: number;
  ascent: number;
  descent: number;
  tracking: number;
}

interface AlphaBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器无法创建绘图画布。 ");
  return context;
}

function fontFamilyFor(grapheme: string, hasLocalFont: boolean): string {
  if (!isChineseGrapheme(grapheme)) return '"Cinzel", serif';
  return hasLocalFont
    ? `"${LOCAL_CHINESE_FONT_FAMILY}", "Noto Sans SC", sans-serif`
    : '"Noto Sans SC", sans-serif';
}

function setGlyphFont(
  context: CanvasRenderingContext2D,
  fontSize: number,
  grapheme: string,
  hasLocalFont: boolean,
): void {
  context.font = `400 ${fontSize}px ${fontFamilyFor(grapheme, hasLocalFont)}`;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
}

function measureRun(
  context: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  letterSpacing: number,
  hasLocalFont: boolean,
): RunMetric {
  const graphemes = splitGraphemes(text);
  const tracking = fontSize * letterSpacing;
  let width = 0;
  let ascent = 0;
  let descent = 0;

  const glyphs = graphemes.map((grapheme) => {
    setGlyphFont(context, fontSize, grapheme, hasLocalFont);
    const metric = context.measureText(grapheme);
    const advance = metric.width;
    width += advance;
    ascent = Math.max(ascent, metric.actualBoundingBoxAscent || fontSize * 0.82);
    descent = Math.max(descent, metric.actualBoundingBoxDescent || fontSize * 0.18);
    return { grapheme, advance };
  });

  width += tracking * Math.max(0, glyphs.length - 1);
  return { glyphs, width: Math.max(1, width), ascent, descent, tracking };
}

function drawRun(
  context: CanvasRenderingContext2D,
  run: RunMetric,
  startX: number,
  baseline: number,
  fontSize: number,
  hasLocalFont: boolean,
): void {
  let x = startX;
  for (const glyph of run.glyphs) {
    setGlyphFont(context, fontSize, glyph.grapheme, hasLocalFont);
    context.fillText(glyph.grapheme, x, baseline);
    x += glyph.advance + run.tracking;
  }
}

function findAlphaBounds(
  canvas: HTMLCanvasElement,
  threshold = 1,
  maxY = canvas.height,
): AlphaBounds | null {
  const context = getContext(canvas);
  const data = context.getImageData(0, 0, canvas.width, Math.min(canvas.height, maxY)).data;
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  const scanHeight = Math.min(canvas.height, maxY);

  for (let y = 0; y < scanHeight; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = data[(y * canvas.width + x) * 4 + 3] ?? 0;
      if (alpha <= threshold) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  return right >= left && bottom >= top ? { left, top, right, bottom } : null;
}

function sharpenMask(mask: HTMLCanvasElement): void {
  const context = getContext(mask);
  const image = context.getImageData(0, 0, mask.width, mask.height);
  const { data } = image;

  for (let index = 3; index < data.length; index += 4) {
    const alpha = (data[index] ?? 0) / 255;
    const normalized = Math.min(1, Math.max(0, (alpha - 0.15) / 0.7));
    const sharpened = normalized * normalized * (3 - 2 * normalized);
    data[index] = Math.round(sharpened * 255);
  }
  context.putImageData(image, 0, 0);
}

function colorizeMask(
  mask: HTMLCanvasElement,
  color: string,
): HTMLCanvasElement {
  const layer = createCanvas(mask.width, mask.height);
  const context = getContext(layer);
  context.drawImage(mask, 0, 0);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, layer.width, layer.height);
  return layer;
}

function directionalEdge(
  mask: HTMLCanvasElement,
  offsetX: number,
  offsetY: number,
): HTMLCanvasElement {
  const edge = createCanvas(mask.width, mask.height);
  const context = getContext(edge);
  context.drawImage(mask, 0, 0);
  context.globalCompositeOperation = "destination-out";
  context.drawImage(mask, offsetX, offsetY);
  return edge;
}

function innerEdge(mask: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const eroded = createCanvas(mask.width, mask.height);
  const erosion = getContext(eroded);
  erosion.drawImage(mask, 0, 0);
  erosion.globalCompositeOperation = "destination-in";
  const offsets: Array<readonly [number, number]> = [
    [-radius, 0],
    [radius, 0],
    [0, -radius],
    [0, radius],
  ];
  for (const [x, y] of offsets) erosion.drawImage(mask, x, y);

  const edge = createCanvas(mask.width, mask.height);
  const context = getContext(edge);
  context.drawImage(mask, 0, 0);
  context.globalCompositeOperation = "destination-out";
  context.drawImage(eroded, 0, 0);
  return edge;
}

function spreadMask(mask: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const spread = createCanvas(mask.width, mask.height);
  const context = getContext(spread);
  const safeRadius = Math.max(1, Math.round(radius));
  for (let step = 0; step < 12; step += 1) {
    const angle = (Math.PI * 2 * step) / 12;
    context.drawImage(
      mask,
      Math.cos(angle) * safeRadius,
      Math.sin(angle) * safeRadius,
    );
  }
  context.drawImage(mask, 0, 0);
  return spread;
}

function drawLayer(
  target: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  options: {
    alpha?: number;
    blend?: GlobalCompositeOperation;
    filter?: string;
    x?: number;
    y?: number;
  } = {},
): void {
  target.save();
  target.globalAlpha = options.alpha ?? 1;
  target.globalCompositeOperation = options.blend ?? "source-over";
  target.filter = options.filter ?? "none";
  target.drawImage(layer, options.x ?? 0, options.y ?? 0);
  target.restore();
}

function renderEffects(
  mask: HTMLCanvasElement,
  preset: LanguagePreset,
  scale: number,
): HTMLCanvasElement {
  const output = createCanvas(mask.width, mask.height);
  const context = getContext(output);
  const glowOpacity = Math.min(1, 0.5 * (preset.glowStrength / 50));

  const spread = spreadMask(mask, OUTER_GLOW_SIZE * 0.1 * scale);
  drawLayer(context, colorizeMask(spread, OUTER_GLOW_COLOR), {
    alpha: glowOpacity,
    blend: "screen",
    filter: `blur(${OUTER_GLOW_SIZE * scale}px)`,
  });

  drawLayer(context, colorizeMask(mask, SHADOW_COLOR), {
    alpha: 0.38,
    blend: "multiply",
    x: Math.max(1, scale),
    y: Math.max(2, scale * 2),
  });
  drawLayer(context, colorizeMask(mask, preset.baseColor));

  const edgeRadius = Math.max(1, Math.round(2.5 * scale));
  const glowEdge = innerEdge(mask, edgeRadius);
  drawLayer(context, colorizeMask(glowEdge, INNER_GLOW_COLOR), {
    alpha: 0.15,
    blend: "screen",
    filter: `blur(${Math.max(1, scale)}px)`,
  });

  // Photoshop's 5px bevel changes the light falloff rather than shifting the
  // entire glyph by five pixels. A smaller directional offset keeps the gold
  // face visible on narrow CJK strokes while retaining a crisp raised edge.
  const bevelOffset = Math.max(1, Math.round(BEVEL_SIZE * 0.3 * scale));
  const highlight = directionalEdge(mask, bevelOffset, bevelOffset);
  const shadow = directionalEdge(mask, -bevelOffset, -bevelOffset);
  drawLayer(context, colorizeMask(highlight, HIGHLIGHT_COLOR), {
    alpha: 0.62,
  });
  drawLayer(context, colorizeMask(shadow, SHADOW_COLOR), {
    alpha: 0.68,
    blend: "multiply",
  });

  const fineHighlight = directionalEdge(mask, Math.max(1, scale), Math.max(1, scale));
  drawLayer(context, colorizeMask(fineHighlight, "#fffdf3"), {
    alpha: 0.3,
    blend: "screen",
  });
  return output;
}

function cropToAlpha(canvas: HTMLCanvasElement, padding: number): HTMLCanvasElement {
  const bounds = findAlphaBounds(canvas, 1);
  if (!bounds) return createCanvas(1, 1);
  const left = Math.max(0, bounds.left - padding);
  const top = Math.max(0, bounds.top - padding);
  const right = Math.min(canvas.width - 1, bounds.right + padding);
  const bottom = Math.min(canvas.height - 1, bounds.bottom + padding);
  const cropped = createCanvas(right - left + 1, bottom - top + 1);
  getContext(cropped).drawImage(
    canvas,
    left,
    top,
    cropped.width,
    cropped.height,
    0,
    0,
    cropped.width,
    cropped.height,
  );
  return cropped;
}

export async function renderTitle(config: TitleConfig): Promise<RenderResult> {
  const areaText = config.areaText.trim();
  const dutyText = config.dutyText.trim();
  if (!areaText || !dutyText) throw new Error("请填写区域名称和副本名称。 ");

  const language: ActiveLanguage = resolveLanguage(
    config.styleMode,
    areaText,
    dutyText,
  );
  const preset = config.presets[language];
  const scale = config.exportScale;
  const measurement = createCanvas(1, 1);
  const measureContext = getContext(measurement);
  const areaSize = preset.areaFontSize * scale;
  const dutySize = preset.dutyFontSize * scale;
  const area = measureRun(
    measureContext,
    areaText,
    areaSize,
    preset.areaLetterSpacing,
    config.hasLocalChineseFont,
  );
  const duty = measureRun(
    measureContext,
    dutyText,
    dutySize,
    preset.dutyLetterSpacing,
    config.hasLocalChineseFont,
  );

  const padding = Math.ceil((OUTER_GLOW_SIZE + BEVEL_SIZE + 12) * scale);
  const lineY = padding + area.ascent + area.descent + preset.areaLineGap * scale;
  const dutyBaseline =
    lineY + preset.lineThickness * scale + preset.lineDutyGap * scale + duty.ascent;
  const width = Math.ceil(Math.max(area.width, duty.width) + padding * 2);
  const height = Math.ceil(dutyBaseline + duty.descent + padding);
  assertSafeCanvasSize(width, height);

  const mask = createCanvas(width, height);
  const maskContext = getContext(mask);
  maskContext.fillStyle = "#ffffff";
  drawRun(
    maskContext,
    area,
    (width - area.width) / 2,
    padding + area.ascent,
    areaSize,
    config.hasLocalChineseFont,
  );

  const areaBounds = findAlphaBounds(mask, 20, Math.ceil(lineY));
  const fallbackLeft = Math.round((width - area.width) / 2);
  const lineLeft = areaBounds?.left ?? fallbackLeft;
  const lineRight = areaBounds?.right ?? Math.round(fallbackLeft + area.width);
  maskContext.fillRect(
    lineLeft,
    Math.round(lineY),
    Math.max(1, lineRight - lineLeft + 1),
    Math.max(1, Math.round(preset.lineThickness * scale)),
  );

  drawRun(
    maskContext,
    duty,
    (width - duty.width) / 2,
    dutyBaseline,
    dutySize,
    config.hasLocalChineseFont,
  );
  sharpenMask(mask);

  const effected = renderEffects(mask, preset, scale);
  const cropped = cropToAlpha(effected, Math.max(2, scale * 2));
  assertSafeCanvasSize(cropped.width, cropped.height);
  return {
    canvas: cropped,
    width: cropped.width,
    height: cropped.height,
    language,
  };
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (format === "png") {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("PNG 生成失败。"))),
        "image/png",
      );
      return;
    }

    const jpeg = createCanvas(canvas.width, canvas.height);
    const context = getContext(jpeg);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, jpeg.width, jpeg.height);
    context.drawImage(canvas, 0, 0);
    jpeg.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("JPG 生成失败。"))),
      "image/jpeg",
      0.95,
    );
  });
}
