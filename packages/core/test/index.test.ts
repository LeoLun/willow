import { describe, expect, it } from "vitest";
import { TOOL_NAMES } from "../src/index.js";

describe("core exports", () => {
  it("exports every built-in Willow tool name", () => {
    expect(TOOL_NAMES).toEqual(["bash", "read", "write", "edit", "ls", "grep", "find"]);
  });
});
