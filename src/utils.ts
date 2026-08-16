import type { ActiveLanguage, StyleMode } from "./types";

const HAN_OR_CJK_PUNCTUATION = /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/u;
const VALID_FONT_EXTENSION = /\.(otf|ttf|woff2?)$/i;

export const MAX_FONT_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_CANVAS_EDGE = 8192;
export const MAX_CANVAS_AREA = 16_000_000;

export function splitGraphemes(text: string): string[] {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (entry) => entry.segment);
  }
  return Array.from(text);
}

export function isChineseGrapheme(grapheme: string): boolean {
  return HAN_OR_CJK_PUNCTUATION.test(grapheme);
}

export function containsChinese(text: string): boolean {
  return HAN_OR_CJK_PUNCTUATION.test(text);
}

export function resolveLanguage(
  mode: StyleMode,
  areaText: string,
  dutyText: string,
): ActiveLanguage {
  if (mode !== "auto") return mode;
  return containsChinese(`${areaText}${dutyText}`) ? "zh" : "en";
}

export function sanitizeFileName(value: string): string {
  const cleaned = value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return cleaned.slice(0, 120) || "ffxiv-title";
}

export function validateFontFileMetadata(file: Pick<File, "name" | "size">): string | null {
  if (!VALID_FONT_EXTENSION.test(file.name)) {
    return "请选择 OTF、TTF、WOFF 或 WOFF2 字体文件。";
  }
  if (file.size <= 0) return "字体文件为空，请重新选择。";
  if (file.size > MAX_FONT_FILE_SIZE) return "字体文件不能超过 25MB。";
  return null;
}

export function assertSafeCanvasSize(width: number, height: number): void {
  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_CANVAS_EDGE ||
    height > MAX_CANVAS_EDGE ||
    width * height > MAX_CANVAS_AREA
  ) {
    throw new Error("当前图片尺寸过大，请降低字号、导出倍率或缩短标题。 ");
  }
}

