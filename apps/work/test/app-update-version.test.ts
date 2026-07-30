import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getAppPath: vi.fn(() => "/app"),
    getPath: vi.fn(() => "/user"),
    getVersion: vi.fn(() => "1.0.0"),
    isPackaged: true,
  },
  shell: { openExternal: vi.fn() },
}));

import {
  classifyUpdate,
  compareVersions,
  parseStableVersion,
} from "../src/main/service/app-update.service";

describe("app update version policy", () => {
  it("accepts only stable three-part semantic versions", () => {
    expect(parseStableVersion("v1.2.3")).toMatchObject({ normalized: "1.2.3", major: 1 });
    expect(parseStableVersion("1.2.3-beta.1")).toBeUndefined();
    expect(parseStableVersion("1.2")).toBeUndefined();
    expect(parseStableVersion("01.2.3")).toBeUndefined();
  });

  it("compares versions numerically", () => {
    expect(
      compareVersions(parseStableVersion("1.10.0")!, parseStableVersion("1.2.9")!),
    ).toBeGreaterThan(0);
  });

  it("uses ASAR only for newer v1 releases in the same major", () => {
    expect(classifyUpdate("1.0.0", "1.0.1")).toBe("hot");
    expect(classifyUpdate("1.9.0", "2.0.0")).toBe("manual");
    expect(classifyUpdate("0.1.0", "1.0.0")).toBe("manual");
    expect(classifyUpdate("1.2.0", "1.1.9")).toBe("none");
    expect(classifyUpdate("1.0.0", "1.1.0-beta.1")).toBe("none");
  });
});
