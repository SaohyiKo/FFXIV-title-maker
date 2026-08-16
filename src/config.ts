import type { LanguagePreset, TitleConfig } from "./types";

export const CHINESE_DEFAULT: LanguagePreset = {
  areaFontSize: 32,
  dutyFontSize: 72,
  areaLetterSpacing: -0.1,
  dutyLetterSpacing: -0.1,
  areaLineGap: 4,
  lineDutyGap: 8,
  lineThickness: 2,
  baseColor: "#be944f",
  glowStrength: 50,
};

export const ENGLISH_DEFAULT: LanguagePreset = {
  areaFontSize: 38,
  dutyFontSize: 92,
  areaLetterSpacing: 0.38,
  dutyLetterSpacing: -0.08,
  areaLineGap: 5,
  lineDutyGap: 10,
  lineThickness: 3,
  baseColor: "#be944f",
  glowStrength: 50,
};

export function clonePreset(preset: LanguagePreset): LanguagePreset {
  return { ...preset };
}

export function createDefaultConfig(): TitleConfig {
  return {
    areaText: "古代世界",
    dutyText: "创造环境极北造物院",
    styleMode: "auto",
    presets: {
      zh: clonePreset(CHINESE_DEFAULT),
      en: clonePreset(ENGLISH_DEFAULT),
    },
    exportScale: 2,
    formats: { png: true, jpg: false },
    hasLocalChineseFont: false,
  };
}

