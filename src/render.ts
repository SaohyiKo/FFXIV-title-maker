import { LOCAL_CHINESE_FONT_FAMILY } from "./font";
import type {
  ActiveLanguage,
  BackgroundImageState,
  CompositeConfig,
  CompositePlacement,
  CompositeRenderResult,
  ExportFormat,
  LanguagePreset,
  OutputDimensions,
  RenderResult,
  TitleConfig,
} from "./types";
import {
  assertSafeCanvasSize,
  englishSmallCapScales,
  fitDimensionsToLimits,
  isChineseGrapheme,
  resolveLanguage,
  splitGraphemes,
} from "./utils";

const HIGHLIGHT_COLOR = "#f7f7eb";
const SHADOW_COLOR = "#644824";
const INNER_GLOW_COLOR = "#f2d99b";
const OUTER_GLOW_COLOR = "#7d7762";
const CHINESE_HIGHLIGHT_RGB = [211, 190, 151] as const; // #d3be97
const CHINESE_INNER_GLOW_COLOR = "#cfc7b9";
const CHINESE_OUTLINE_COLOR = "#292723";
const CHINESE_CAST_SHADOW_COLOR = "#171614";
const OUTER_GLOW_SIZE = 24;
const BEVEL_SIZE = 5;
const BEVEL_DEPTH = 10;
const BEVEL_LIGHT_ANGLE = 120;
const BEVEL_LIGHT_ELEVATION = 20;
export const COMPOSITE_DUTY_HEIGHT_RATIO = 0.105;
export const COMPOSITE_MAX_TITLE_WIDTH_RATIO = 0.78;

interface GlyphMetric {
  grapheme: string;
  advance: number;
  fontSize: number;
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
  useEnglishSmallCaps: boolean,
): RunMetric {
  const graphemes = splitGraphemes(text);
  const glyphScales = useEnglishSmallCaps
    ? englishSmallCapScales(text)
    : graphemes.map(() => 1);
  const tracking = fontSize * letterSpacing;
  let width = 0;
  let ascent = 0;
  let descent = 0;

  const glyphs = graphemes.map((grapheme, index) => {
    const glyphFontSize = fontSize * (glyphScales[index] ?? 1);
    setGlyphFont(context, glyphFontSize, grapheme, hasLocalFont);
    const metric = context.measureText(grapheme);
    const advance = metric.width;
    width += advance;
    ascent = Math.max(ascent, metric.actualBoundingBoxAscent || glyphFontSize * 0.82);
    descent = Math.max(descent, metric.actualBoundingBoxDescent || glyphFontSize * 0.18);
    return { grapheme, advance, fontSize: glyphFontSize };
  });

  width += tracking * Math.max(0, glyphs.length - 1);
  return { glyphs, width: Math.max(1, width), ascent, descent, tracking };
}

function drawRun(
  context: CanvasRenderingContext2D,
  run: RunMetric,
  startX: number,
  baseline: number,
  hasLocalFont: boolean,
): void {
  let x = startX;
  for (const glyph of run.glyphs) {
    setGlyphFont(context, glyph.fontSize, glyph.grapheme, hasLocalFont);
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

function parseHexColor(color: string): readonly [number, number, number] {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) return [190, 148, 79];
  return [
    Number.parseInt(match[1] ?? "be", 16),
    Number.parseInt(match[2] ?? "94", 16),
    Number.parseInt(match[3] ?? "4f", 16),
  ];
}

function createChineseFaceLayer(
  mask: HTMLCanvasElement,
  baseColor: string,
  scale: number,
): HTMLCanvasElement {
  const { width, height } = mask;
  const maskData = getContext(mask).getImageData(0, 0, width, height).data;
  const layer = createCanvas(width, height);
  const context = getContext(layer);
  const image = context.createImageData(width, height);
  const activeRows = new Uint8Array(height);
  const gapTolerance = Math.max(1, Math.round(scale * 1.5));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((maskData[(y * width + x) * 4 + 3] ?? 0) > 8) {
        activeRows[y] = 1;
        break;
      }
    }
  }

  const bands: Array<{ top: number; bottom: number }> = [];
  let top = -1;
  let lastActive = -1;
  for (let y = 0; y < height; y += 1) {
    if (activeRows[y] === 0) continue;
    if (top < 0 || y - lastActive > gapTolerance + 1) {
      if (top >= 0) bands.push({ top, bottom: lastActive });
      top = y;
    }
    lastActive = y;
  }
  if (top >= 0) bands.push({ top, bottom: lastActive });

  const [baseRed, baseGreen, baseBlue] = parseHexColor(baseColor);
  for (const band of bands) {
    const bandHeight = Math.max(1, band.bottom - band.top);
    for (let y = band.top; y <= band.bottom; y += 1) {
      const position = (y - band.top) / bandHeight;
      const lowerFalloff = smoothStep(Math.max(0, (position - 0.15) / 0.85));
      const tone = 1 - lowerFalloff * 0.18;
      for (let x = 0; x < width; x += 1) {
        const pixel = (y * width + x) * 4;
        const alpha = maskData[pixel + 3] ?? 0;
        if (alpha === 0) continue;
        image.data[pixel] = Math.round(baseRed * tone);
        image.data[pixel + 1] = Math.round(baseGreen * tone);
        image.data[pixel + 2] = Math.round(baseBlue * tone);
        image.data[pixel + 3] = alpha;
      }
    }
  }

  context.putImageData(image, 0, 0);
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

function renderLegacyEffects(
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

function smoothStep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function metallicGlossContour(position: number): number {
  const primary = Math.exp(-Math.pow((position - 0.28) / 0.16, 2));
  const secondary = 0.48 * Math.exp(-Math.pow((position - 0.72) / 0.12, 2));
  return Math.min(1, primary + secondary);
}

function createInsideDistanceField(mask: HTMLCanvasElement): {
  alpha: Uint8ClampedArray;
  distance: Uint16Array;
} {
  const { width, height } = mask;
  const source = getContext(mask).getImageData(0, 0, width, height).data;
  const alpha = new Uint8ClampedArray(width * height);
  const distance = new Uint16Array(width * height);
  const infinity = 0xffff;

  for (let index = 0; index < alpha.length; index += 1) {
    const maskAlpha = source[index * 4 + 3] ?? 0;
    alpha[index] = maskAlpha;
    distance[index] = maskAlpha > 8 ? infinity : 0;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (distance[index] === 0) continue;
      let best = distance[index] ?? infinity;
      if (x > 0) best = Math.min(best, (distance[index - 1] ?? infinity) + 3);
      if (y > 0) best = Math.min(best, (distance[index - width] ?? infinity) + 3);
      if (x > 0 && y > 0) {
        best = Math.min(best, (distance[index - width - 1] ?? infinity) + 4);
      }
      if (x + 1 < width && y > 0) {
        best = Math.min(best, (distance[index - width + 1] ?? infinity) + 4);
      }
      distance[index] = best;
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      if (distance[index] === 0) continue;
      let best = distance[index] ?? infinity;
      if (x + 1 < width) best = Math.min(best, (distance[index + 1] ?? infinity) + 3);
      if (y + 1 < height) best = Math.min(best, (distance[index + width] ?? infinity) + 3);
      if (x + 1 < width && y + 1 < height) {
        best = Math.min(best, (distance[index + width + 1] ?? infinity) + 4);
      }
      if (x > 0 && y + 1 < height) {
        best = Math.min(best, (distance[index + width - 1] ?? infinity) + 4);
      }
      distance[index] = best;
    }
  }

  return { alpha, distance };
}

function createLineVerticalPositionMap(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  scale: number,
): Float32Array {
  const positions = new Float32Array(height);
  positions.fill(0.5);
  const activeRows = new Uint8Array(height);
  const gapTolerance = Math.max(1, Math.round(scale * 1.5));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((alpha[y * width + x] ?? 0) > 8) {
        activeRows[y] = 1;
        break;
      }
    }
  }

  const fillBand = (top: number, bottom: number): void => {
    const bandHeight = Math.max(1, bottom - top);
    for (let y = top; y <= bottom; y += 1) {
      positions[y] = (y - top) / bandHeight;
    }
  };

  let top = -1;
  let lastActive = -1;
  for (let y = 0; y < height; y += 1) {
    if (activeRows[y] === 0) continue;
    if (top < 0 || y - lastActive > gapTolerance + 1) {
      if (top >= 0) fillBand(top, lastActive);
      top = y;
    }
    lastActive = y;
  }
  if (top >= 0) fillBand(top, lastActive);
  return positions;
}

function createChineseBevelLayers(
  mask: HTMLCanvasElement,
  scale: number,
): { highlight: HTMLCanvasElement; shadow: HTMLCanvasElement } {
  const { width, height } = mask;
  const { alpha, distance } = createInsideDistanceField(mask);
  const bevelRadius = Math.max(1, BEVEL_SIZE * scale);
  const distanceLimit = bevelRadius * 3;
  const heightAt = (index: number): number => {
    if ((alpha[index] ?? 0) <= 8) return 0;
    return smoothStep(Math.min(1, (distance[index] ?? 0) / distanceLimit));
  };

  const angle = (BEVEL_LIGHT_ANGLE * Math.PI) / 180;
  const elevation = (BEVEL_LIGHT_ELEVATION * Math.PI) / 180;
  const horizontalLight = Math.cos(elevation);
  const lightX = Math.cos(angle) * horizontalLight;
  const lightY = -Math.sin(angle) * horizontalLight;
  const lightZ = Math.sin(elevation);

  const highlight = createCanvas(width, height);
  const shadow = createCanvas(width, height);
  const highlightContext = getContext(highlight);
  const shadowContext = getContext(shadow);
  const highlightImage = highlightContext.createImageData(width, height);
  const shadowImage = shadowContext.createImageData(width, height);
  const highlightRgb = CHINESE_HIGHLIGHT_RGB;
  const shadowRgb = [0, 0, 0] as const;
  const gradientDepth = BEVEL_DEPTH * scale;
  const verticalPosition = createLineVerticalPositionMap(
    alpha,
    width,
    height,
    scale,
  );

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const maskAlpha = (alpha[index] ?? 0) / 255;
      if (maskAlpha <= 0) continue;

      const position = Math.min(1, (distance[index] ?? 0) / distanceLimit);
      if (position >= 1) continue;
      const left = heightAt(index - 1);
      const right = heightAt(index + 1);
      const top = heightAt(index - width);
      const bottom = heightAt(index + width);
      const gradientX = ((right - left) * gradientDepth) / 2;
      const gradientY = ((bottom - top) * gradientDepth) / 2;
      const normalLength = Math.hypot(gradientX, gradientY, 1);
      const normalX = -gradientX / normalLength;
      const normalY = -gradientY / normalLength;
      const normalZ = 1 / normalLength;
      const light = normalX * lightX + normalY * lightY + normalZ * lightZ;

      const bevelZone = Math.pow(Math.sin(Math.PI * position), 0.42);
      const contour = metallicGlossContour(position);
      const verticalHighlightWeight = 1 - smoothStep(verticalPosition[y] ?? 0.5) * 0.42;
      const highlightAmount = Math.min(
        1,
        bevelZone
          * contour
          * Math.max(0, (light + 0.08) / 0.72)
          * 1.45
          * verticalHighlightWeight,
      );
      const shadowAmount = Math.min(
        1,
        bevelZone * Math.max(0, (0.34 - light) / 0.72) * 0.82,
      );
      const pixel = index * 4;

      highlightImage.data[pixel] = highlightRgb[0];
      highlightImage.data[pixel + 1] = highlightRgb[1];
      highlightImage.data[pixel + 2] = highlightRgb[2];
      highlightImage.data[pixel + 3] = Math.round(255 * maskAlpha * highlightAmount);
      shadowImage.data[pixel] = shadowRgb[0];
      shadowImage.data[pixel + 1] = shadowRgb[1];
      shadowImage.data[pixel + 2] = shadowRgb[2];
      shadowImage.data[pixel + 3] = Math.round(255 * maskAlpha * shadowAmount);
    }
  }

  highlightContext.putImageData(highlightImage, 0, 0);
  shadowContext.putImageData(shadowImage, 0, 0);
  return { highlight, shadow };
}

function renderChineseMetalEffects(
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

  drawLayer(context, colorizeMask(mask, CHINESE_CAST_SHADOW_COLOR), {
    alpha: 0.9,
    filter: `blur(${Math.max(1, 5.2 * scale)}px)`,
    x: scale,
    y: 3.2 * scale,
  });
  const outline = spreadMask(mask, Math.max(1, 2 * scale));
  drawLayer(context, colorizeMask(outline, CHINESE_OUTLINE_COLOR), {
    alpha: 0.84,
    filter: `blur(${Math.max(0.5, 0.75 * scale)}px)`,
    y: Math.max(1, scale),
  });
  drawLayer(context, createChineseFaceLayer(mask, preset.baseColor, scale));

  const edgeRadius = Math.max(1, Math.round(2.5 * scale));
  const glowEdge = innerEdge(mask, edgeRadius);
  drawLayer(context, colorizeMask(glowEdge, CHINESE_INNER_GLOW_COLOR), {
    alpha: 0.08,
    blend: "color-dodge",
    filter: `blur(${Math.max(1, scale)}px)`,
  });

  const bevel = createChineseBevelLayers(mask, scale);
  drawLayer(context, bevel.shadow, {
    alpha: 0.56,
    blend: "multiply",
    filter: `blur(${Math.max(0.25, 0.25 * scale)}px)`,
  });
  drawLayer(context, bevel.highlight, {
    alpha: 0.58,
    blend: "source-over",
  });
  return output;
}

function renderEffects(
  mask: HTMLCanvasElement,
  preset: LanguagePreset,
  scale: number,
  language: ActiveLanguage,
): HTMLCanvasElement {
  return language === "zh"
    ? renderChineseMetalEffects(mask, preset, scale)
    : renderLegacyEffects(mask, preset, scale);
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

export async function renderTitle(
  config: TitleConfig,
  renderScale: number = config.exportScale,
): Promise<RenderResult> {
  const areaText = config.areaText.trim();
  const dutyText = config.dutyText.trim();
  if (!areaText || !dutyText) throw new Error("请填写区域名称和副本名称。 ");

  const language: ActiveLanguage = resolveLanguage(
    config.styleMode,
    areaText,
    dutyText,
  );
  const preset = config.presets[language];
  const scale = renderScale;
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("标题渲染比例无效。 ");
  }
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
    language === "en",
  );
  const duty = measureRun(
    measureContext,
    dutyText,
    dutySize,
    preset.dutyLetterSpacing,
    config.hasLocalChineseFont,
    language === "en",
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
    config.hasLocalChineseFont,
  );
  sharpenMask(mask);

  const effected = renderEffects(mask, preset, scale, language);
  const cropped = cropToAlpha(effected, Math.max(2, scale * 2));
  assertSafeCanvasSize(cropped.width, cropped.height);
  return {
    canvas: cropped,
    width: cropped.width,
    height: cropped.height,
    language,
  };
}

export function compositeTitleRenderScale(
  outputHeight: number,
  dutyFontSize: number,
): number {
  if (outputHeight <= 0 || dutyFontSize <= 0) {
    throw new Error("合成图片尺寸无效。 ");
  }
  return (outputHeight * COMPOSITE_DUTY_HEIGHT_RATIO) / dutyFontSize;
}

export function calculateCompositePlacement(
  outputWidth: number,
  outputHeight: number,
  titleWidth: number,
  titleHeight: number,
  config: CompositeConfig,
): CompositePlacement {
  const requestedScale = Math.min(1.4, Math.max(0.6, config.titleScale));
  const widthLimitScale = (outputWidth * COMPOSITE_MAX_TITLE_WIDTH_RATIO) / titleWidth;
  const scale = Math.min(requestedScale, widthLimitScale);
  const width = titleWidth * scale;
  const height = titleHeight * scale;
  const verticalPosition = Math.min(0.7, Math.max(0.3, config.verticalPosition));
  return {
    x: (outputWidth - width) / 2,
    y: outputHeight * verticalPosition - height / 2,
    width,
    height,
    scale,
  };
}

export function renderComposite(
  background: BackgroundImageState,
  titleLayer: HTMLCanvasElement,
  config: CompositeConfig,
  outputDimensions: OutputDimensions = fitDimensionsToLimits(
    background.width,
    background.height,
  ),
): CompositeRenderResult {
  assertSafeCanvasSize(outputDimensions.width, outputDimensions.height);
  const canvas = createCanvas(outputDimensions.width, outputDimensions.height);
  const context = getContext(canvas);
  context.drawImage(
    background.image,
    0,
    0,
    background.width,
    background.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const placement = calculateCompositePlacement(
    canvas.width,
    canvas.height,
    titleLayer.width,
    titleLayer.height,
    config,
  );
  context.drawImage(
    titleLayer,
    placement.x,
    placement.y,
    placement.width,
    placement.height,
  );

  return {
    canvas,
    width: canvas.width,
    height: canvas.height,
    resized: outputDimensions.resized,
    placement,
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
