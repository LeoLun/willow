import { describe, expect, it } from "vitest";
import { calculateDefaultWindowBounds } from "../src/main/window/default-window-bounds";

describe("calculateDefaultWindowBounds", () => {
  it("uses a fixed 1400 by 900 size centered in the work area", () => {
    expect(calculateDefaultWindowBounds({ x: 0, y: 25, width: 1512, height: 917 })).toEqual({
      x: 56,
      y: 33,
      width: 1400,
      height: 900,
    });
  });

  it("keeps the fixed size when the work area is smaller", () => {
    expect(calculateDefaultWindowBounds({ x: 100, y: 40, width: 1000, height: 1200 })).toEqual({
      x: -100,
      y: 190,
      width: 1400,
      height: 900,
    });
  });
});
