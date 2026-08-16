import { describe, expect, it } from "vitest";
import {
  assertSafeCanvasSize,
  containsChinese,
  isChineseGrapheme,
  resolveLanguage,
  sanitizeFileName,
  splitGraphemes,
  validateFontFileMetadata,
} from "./utils";

describe("language detection", () => {
  it("uses Chinese preset when either title contains Han characters", () => {
    expect(resolveLanguage("auto", "古代世界", "THE SKYDEEP CENOTE")).toBe("zh");
    expect(containsChinese("A极B")).toBe(true);
  });

  it("keeps pure English on the English preset", () => {
    expect(resolveLanguage("auto", "YOK TURAL", "THE SKYDEEP CENOTE")).toBe("en");
  });

  it("respects manual mode", () => {
    expect(resolveLanguage("en", "古代世界", "副本")).toBe("en");
    expect(resolveLanguage("zh", "YOK TURAL", "DUTY")).toBe("zh");
  });

  it("classifies CJK punctuation as Chinese and Latin punctuation as English", () => {
    expect(isChineseGrapheme("。 ".trim())).toBe(true);
    expect(isChineseGrapheme("!")).toBe(false);
  });
});

describe("text utilities", () => {
  it("segments combined emoji as one grapheme", () => {
    expect(splitGraphemes("A👩‍💻B")).toEqual(["A", "👩‍💻", "B"]);
  });

  it("creates safe, non-empty filenames", () => {
    expect(sanitizeFileName('古代/世界:副本?')).toBe("古代-世界-副本-");
    expect(sanitizeFileName("   ")).toBe("ffxiv-title");
  });
});

describe("input limits", () => {
  it("validates local font metadata", () => {
    expect(validateFontFileMetadata({ name: "AdobeHeiti.otf", size: 2_000 })).toBeNull();
    expect(validateFontFileMetadata({ name: "font.exe", size: 2_000 })).toContain("OTF");
    expect(validateFontFileMetadata({ name: "font.ttf", size: 26 * 1024 * 1024 })).toContain("25MB");
  });

  it("rejects unsafe canvases", () => {
    expect(() => assertSafeCanvasSize(4096, 2048)).not.toThrow();
    expect(() => assertSafeCanvasSize(9000, 100)).toThrow();
    expect(() => assertSafeCanvasSize(5000, 5000)).toThrow();
  });
});

