import { describe, expect, it } from "vitest";
import {
  CHINESE_DEFAULT,
  ENGLISH_DEFAULT,
  createDefaultConfig,
} from "./config";

describe("language presets", () => {
  it("keeps Adobe-style Chinese tracking at Photoshop -100", () => {
    expect(CHINESE_DEFAULT.areaLetterSpacing).toBe(-0.1);
    expect(CHINESE_DEFAULT.dutyLetterSpacing).toBe(-0.1);
  });

  it("keeps the independent English reference proportions", () => {
    expect(ENGLISH_DEFAULT.areaFontSize).toBe(38);
    expect(ENGLISH_DEFAULT.dutyFontSize).toBe(92);
    expect(ENGLISH_DEFAULT.areaLetterSpacing).toBe(0.38);
    expect(ENGLISH_DEFAULT.dutyLetterSpacing).toBe(-0.08);
  });

  it("creates independently mutable Chinese and English presets", () => {
    const first = createDefaultConfig();
    const second = createDefaultConfig();
    first.presets.zh.areaFontSize = 99;
    first.presets.en.areaFontSize = 55;
    expect(second.presets.zh.areaFontSize).toBe(32);
    expect(second.presets.en.areaFontSize).toBe(38);
  });
});

