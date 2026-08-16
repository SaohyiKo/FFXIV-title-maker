export type StyleMode = "auto" | "zh" | "en";
export type ActiveLanguage = "zh" | "en";
export type ExportScale = 1 | 2 | 4;
export type ExportFormat = "png" | "jpg";
export type PreviewMode = "title" | "composite";

export interface LanguageDraft {
  areaText: string;
  dutyText: string;
  initialized: boolean;
}

export type LanguageDrafts = Record<ActiveLanguage, LanguageDraft>;

export interface CompositeConfig {
  enabled: boolean;
  titleScale: number;
  verticalPosition: number;
}

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
  languageDrafts: LanguageDrafts;
  presets: Record<ActiveLanguage, LanguagePreset>;
  composite: CompositeConfig;
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

export interface BackgroundImageState {
  fileName: string;
  width: number;
  height: number;
  image: ImageBitmap | HTMLImageElement;
  objectUrl?: string;
}

export interface OutputDimensions {
  width: number;
  height: number;
  scale: number;
  resized: boolean;
}

export interface CompositePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface CompositeRenderResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  resized: boolean;
  placement: CompositePlacement;
}
