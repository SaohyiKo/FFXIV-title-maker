import { describe, expect, it } from "vitest";
import {
  CHINESE_DEFAULT,
  CHINESE_DEFAULT_TEXT,
  ENGLISH_DEFAULT,
  ENGLISH_DEFAULT_TEXT,
  createDefaultConfig,
  fillLanguageDraftDefaults,
} from "./config";

describe("language presets", () => {
  it("keeps the revised independent Chinese tracking defaults", () => {
    expect(CHINESE_DEFAULT.areaLetterSpacing).toBe(0.1);
    expect(CHINESE_DEFAULT.dutyLetterSpacing).toBe(-0.12);
    expect(CHINESE_DEFAULT.glowStrength).toBe(75);
  });

  it("keeps the independent English reference proportions", () => {
    expect(ENGLISH_DEFAULT.areaFontSize).toBe(38);
    expect(ENGLISH_DEFAULT.dutyFontSize).toBe(92);
    expect(ENGLISH_DEFAULT.areaLetterSpacing).toBe(0.38);
    expect(ENGLISH_DEFAULT.dutyLetterSpacing).toBe(0);
    expect(ENGLISH_DEFAULT.glowStrength).toBe(75);
  });

  it("creates independently mutable Chinese and English presets", () => {
    const first = createDefaultConfig();
    const second = createDefaultConfig();
    first.presets.zh.areaFontSize = 99;
    first.presets.en.areaFontSize = 55;
    expect(second.presets.zh.areaFontSize).toBe(32);
    expect(second.presets.en.areaFontSize).toBe(38);
  });

  it("uses the updated Norvrandt and Amaurot examples", () => {
    const config = createDefaultConfig();
    expect(config.areaText).toBe(CHINESE_DEFAULT_TEXT.areaText);
    expect(config.dutyText).toBe(CHINESE_DEFAULT_TEXT.dutyText);
    expect(config.languageDrafts.en.initialized).toBe(false);

    fillLanguageDraftDefaults(config.languageDrafts, "en");
    expect(config.languageDrafts.en.areaText).toBe(ENGLISH_DEFAULT_TEXT.areaText);
    expect(config.languageDrafts.en.dutyText).toBe(ENGLISH_DEFAULT_TEXT.dutyText);
  });

  it("only fills blank draft fields and preserves edited text", () => {
    const config = createDefaultConfig();
    config.languageDrafts.en.areaText = "CUSTOM AREA";
    fillLanguageDraftDefaults(config.languageDrafts, "en");
    expect(config.languageDrafts.en.areaText).toBe("CUSTOM AREA");
    expect(config.languageDrafts.en.dutyText).toBe("AMAUROTA");
  });
});
