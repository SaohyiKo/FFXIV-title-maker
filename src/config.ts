import type {
  ActiveLanguage,
  LanguageDrafts,
  LanguagePreset,
  TitleConfig,
} from "./types";

export const CHINESE_DEFAULT_TEXT = {
  areaText: "诺弗兰特",
  dutyText: "末日暗影亚马乌罗提",
} as const;

export const ENGLISH_DEFAULT_TEXT = {
  areaText: "NORVRANDT",
  dutyText: "AMAUROTA",
} as const;

export const CHINESE_DEFAULT: LanguagePreset = {
  areaFontSize: 32,
  dutyFontSize: 72,
  areaLetterSpacing: 0.1,
  dutyLetterSpacing: -0.12,
  areaLineGap: 4,
  lineDutyGap: 8,
  lineThickness: 2,
  baseColor: "#be944f",
  glowStrength: 75,
};

export const ENGLISH_DEFAULT: LanguagePreset = {
  areaFontSize: 38,
  dutyFontSize: 92,
  areaLetterSpacing: 0.38,
  dutyLetterSpacing: 0,
  areaLineGap: 5,
  lineDutyGap: 10,
  lineThickness: 3,
  baseColor: "#be944f",
  glowStrength: 75,
};

export function clonePreset(preset: LanguagePreset): LanguagePreset {
  return { ...preset };
}

export function createLanguageDrafts(): LanguageDrafts {
  return {
    zh: { ...CHINESE_DEFAULT_TEXT, initialized: true },
    en: { areaText: "", dutyText: "", initialized: false },
  };
}

export function fillLanguageDraftDefaults(
  drafts: LanguageDrafts,
  language: ActiveLanguage,
): void {
  const draft = drafts[language];
  const defaults = language === "zh" ? CHINESE_DEFAULT_TEXT : ENGLISH_DEFAULT_TEXT;
  if (!draft.areaText.trim()) draft.areaText = defaults.areaText;
  if (!draft.dutyText.trim()) draft.dutyText = defaults.dutyText;
  draft.initialized = true;
}

export function createDefaultConfig(): TitleConfig {
  const languageDrafts = createLanguageDrafts();
  return {
    areaText: languageDrafts.zh.areaText,
    dutyText: languageDrafts.zh.dutyText,
    styleMode: "auto",
    languageDrafts,
    presets: {
      zh: clonePreset(CHINESE_DEFAULT),
      en: clonePreset(ENGLISH_DEFAULT),
    },
    composite: {
      enabled: false,
      titleScale: 1,
      verticalPosition: 0.46,
    },
    exportScale: 2,
    formats: { png: true, jpg: false },
    hasLocalChineseFont: false,
  };
}
