import { describe, expect, it } from "vitest";
import { getRendererHistoryMode } from "../src/renderer/src/router-history";

describe("renderer router history", () => {
  it("uses hash history for packaged file URLs", () => {
    expect(getRendererHistoryMode("file:")).toBe("hash");
  });

  it("keeps web history for the development server", () => {
    expect(getRendererHistoryMode("http:")).toBe("web");
    expect(getRendererHistoryMode("https:")).toBe("web");
  });
});
