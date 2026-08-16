import { describe, expect, it } from "vitest";
import {
  COMPOSITE_DUTY_HEIGHT_RATIO,
  COMPOSITE_MAX_TITLE_WIDTH_RATIO,
  calculateCompositePlacement,
  compositeTitleRenderScale,
} from "./render";

describe("composite title layout", () => {
  it("targets a main-title font size of 10.5% of image height", () => {
    const scale = compositeTitleRenderScale(378, 72);
    expect(72 * scale).toBeCloseTo(378 * COMPOSITE_DUTY_HEIGHT_RATIO, 5);
  });

  it("centers the title at the reference vertical position", () => {
    const placement = calculateCompositePlacement(
      672,
      378,
      400,
      100,
      { enabled: true, titleScale: 1, verticalPosition: 0.46 },
    );
    expect(placement.x + placement.width / 2).toBeCloseTo(336, 5);
    expect(placement.y + placement.height / 2).toBeCloseTo(378 * 0.46, 5);
  });

  it("caps long title layers at 78% of the image width", () => {
    const placement = calculateCompositePlacement(
      672,
      378,
      1000,
      100,
      { enabled: true, titleScale: 1.4, verticalPosition: 0.46 },
    );
    expect(placement.width).toBeCloseTo(672 * COMPOSITE_MAX_TITLE_WIDTH_RATIO, 5);
    expect(placement.x + placement.width / 2).toBeCloseTo(336, 5);
  });
});
