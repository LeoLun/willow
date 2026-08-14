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
      "processList",
      "todoList",
      "webfetch",
      "websearch",
      "askUser",
      "listAutomations",
      "createAutomation",
      "updateAutomation",
      "deleteAutomation",
      "writePlan",
      "updatePlan",
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
        TOOL_NAMES.filter(
          (name) => name !== "websearch" && name !== "writePlan" && name !== "updatePlan",
        ),
      );
    }
  });

  it("registers websearch when a Tavily API key is configured", () => {
    const tools = createWillowTools({
      cwd: process.cwd(),
      permissionMode: "full-access",
      tavilyApiKey: "tvly-test",
    });

    expect(tools.map((tool) => tool.name)).toEqual(
      TOOL_NAMES.filter((name) => name !== "writePlan" && name !== "updatePlan"),
    );
  });

  it("registers only the planning capability set in every permission mode", () => {
    for (const permissionMode of [
      "request-approval",
      "delegate-approval",
      "full-access",
    ] as const) {
      const tools = createWillowTools({
        cwd: process.cwd(),
        agentMode: "plan",
        permissionMode,
        tavilyApiKey: "tvly-test",
      });

      expect(tools.map((tool) => tool.name)).toEqual([
        "read",
        "ls",
        "grep",
        "find",
        "webfetch",
        "websearch",
        "askUser",
        "writePlan",
        "updatePlan",
      ]);
    }
  });

  it("omits websearch from Plan mode without Tavily configuration", () => {
    const tools = createWillowTools({
      cwd: process.cwd(),
      agentMode: "plan",
      permissionMode: "full-access",
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      "read",
      "ls",
      "grep",
      "find",
      "webfetch",
      "askUser",
      "writePlan",
      "updatePlan",
    ]);
  });
});
