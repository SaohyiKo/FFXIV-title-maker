import { describe, expect, it } from "vitest";
import {
  assertSafeCanvasSize,
  containsChinese,
  englishSmallCapScales,
  fitDimensionsToLimits,
  isChineseGrapheme,
  resolveLanguage,
  sanitizeFileName,
  splitGraphemes,
  validateFontFileMetadata,
  validateImageFileMetadata,
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

  it("uses full-size English initials and smaller following letters", () => {
    expect(englishSmallCapScales("THE SKYDEEP CENOTE")).toEqual([
      1, 0.82, 0.82, 1,
      1, 0.82, 0.82, 0.82, 0.82, 0.82, 0.82, 1,
      1, 0.82, 0.82, 0.82, 0.82, 0.82,
    ]);
  });
});

describe("input limits", () => {
  it("validates local font metadata", () => {
    expect(validateFontFileMetadata({ name: "AdobeHeiti.otf", size: 2_000 })).toBeNull();
    expect(validateFontFileMetadata({ name: "font.exe", size: 2_000 })).toContain("OTF");
    expect(validateFontFileMetadata({ name: "font.ttf", size: 26 * 1024 * 1024 })).toContain("25MB");
  });

  it("validates local image metadata", () => {
    expect(validateImageFileMetadata({ name: "scene.webp", size: 2_000 })).toBeNull();
    expect(validateImageFileMetadata({ name: "scene.gif", size: 2_000 })).toContain("WebP");
    expect(validateImageFileMetadata({ name: "scene.png", size: 26 * 1024 * 1024 })).toContain("25MB");
  });

  it("keeps normal image dimensions and safely scales oversized images", () => {
    expect(fitDimensionsToLimits(1920, 1080)).toEqual({
      width: 1920,
      height: 1080,
      scale: 1,
      resized: false,
    });
    const oversized = fitDimensionsToLimits(8000, 4000);
    expect(oversized.width / oversized.height).toBeCloseTo(2, 2);
    expect(oversized.width * oversized.height).toBeLessThanOrEqual(16_000_000);
    expect(oversized.resized).toBe(true);
  });

  it("rejects unsafe canvases", () => {
    expect(() => assertSafeCanvasSize(4096, 2048)).not.toThrow();
    expect(() => assertSafeCanvasSize(9000, 100)).toThrow();
    expect(() => assertSafeCanvasSize(5000, 5000)).toThrow();
  });
});
