import { describe, expect, it } from "vitest";
import { createWillowTools, TOOL_NAMES } from "../src/index.js";

describe("core exports", () => {
  it("exports every built-in Willow tool name", () => {
    expect(TOOL_NAMES).toEqual([
      "bash",
      "read",
      "write",
      "edit",
      "ls",
      "grep",
      "find",
      "todoList",
      "webfetch",
      "websearch",
    ]);
  });

  it("registers credential-free tools without Tavily configuration", () => {
    for (const tavilyApiKey of [undefined, "", "   "]) {
      const tools = createWillowTools({
        cwd: process.cwd(),
        permissionMode: "full-access",
        tavilyApiKey,
      });

      expect(tools.map((tool) => tool.name)).toEqual(
        TOOL_NAMES.filter((name) => name !== "websearch"),
      );
    }
  });

  it("registers websearch when a Tavily API key is configured", () => {
    const tools = createWillowTools({
      cwd: process.cwd(),
      permissionMode: "full-access",
      tavilyApiKey: "tvly-test",
    });

    expect(tools.map((tool) => tool.name)).toEqual(TOOL_NAMES);
  });
});
