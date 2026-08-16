import type { ChineseFontState } from "./types";
import { validateFontFileMetadata } from "./utils";

export const LOCAL_CHINESE_FONT_FAMILY = "FFXIV Local Chinese";
let activeFontFace: FontFace | undefined;

export async function loadLocalFont(file: File): Promise<ChineseFontState> {
  const metadataError = validateFontFileMetadata(file);
  if (metadataError) throw new Error(metadataError);

  try {
    const bytes = await file.arrayBuffer();
    const candidate = new FontFace(LOCAL_CHINESE_FONT_FAMILY, bytes, {
      style: "normal",
      weight: "400",
    });
    const loaded = await candidate.load();

    if (activeFontFace) document.fonts.delete(activeFontFace);
    document.fonts.add(loaded);
    activeFontFace = loaded;

    return { source: "local", fileName: file.name, fontFace: loaded };
  } catch {
    throw new Error("无法读取该字体。请确认文件未损坏，并且浏览器支持此字体格式。");
  }
}

export function removeLocalFont(): ChineseFontState {
  if (activeFontFace) document.fonts.delete(activeFontFace);
  activeFontFace = undefined;
  return { source: "fallback" };
}

export async function waitForBundledFonts(hasLocalFont: boolean): Promise<void> {
  const chineseFamily = hasLocalFont
    ? `"${LOCAL_CHINESE_FONT_FAMILY}"`
    : '"Noto Sans SC"';
  await Promise.all([
    document.fonts.load(`400 72px ${chineseFamily}`, "创造环境"),
    document.fonts.load('400 92px "Cinzel"', "THE SKYDEEP CENOTE"),
  ]);
}

