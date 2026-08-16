export type StyleMode = "auto" | "zh" | "en";
export type ActiveLanguage = "zh" | "en";
export type ExportScale = 1 | 2 | 4;
export type ExportFormat = "png" | "jpg";

export interface LanguagePreset {
  areaFontSize: number;
  dutyFontSize: number;
  areaLetterSpacing: number;
  dutyLetterSpacing: number;
  areaLineGap: number;
  lineDutyGap: number;
  lineThickness: number;
  baseColor: string;
  glowStrength: number;
}

export interface TitleConfig {
  areaText: string;
  dutyText: string;
  styleMode: StyleMode;
  presets: Record<ActiveLanguage, LanguagePreset>;
  exportScale: ExportScale;
  formats: Record<ExportFormat, boolean>;
  hasLocalChineseFont: boolean;
}

export interface ChineseFontState {
  source: "fallback" | "local";
  fileName?: string;
  fontFace?: FontFace;
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  language: ActiveLanguage;
}

