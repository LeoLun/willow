import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { describe, expect, it, vi } from "vitest";
import {
  ToolBase,
  type BaseDetails,
  type ToolExecutionContext,
  type ToolRuntimeOptions,
} from "../src/index.js";

const testSchema = Type.Object({
  value: Type.String(),
});

type TestInput = Static<typeof testSchema>;
type TestDetails = BaseDetails & { kind: "read" };

class TestTool extends ToolBase<typeof testSchema, TestDetails> {
  readonly name = "read";
  readonly label = "test";
  readonly description = "Test the shared tool lifecycle.";
  readonly parameters = testSchema;
  readonly events: string[] = [];
  runError?: unknown;

  protected override checkParams(input: TestInput): Error | undefined {
    this.events.push("params");
    return input.value === "invalid" ? new Error("semantic validation failed") : undefined;
  }

  protected override async checkPermission(
    context: ToolExecutionContext<TestInput, TestDetails>,
  ): Promise<void> {
    this.events.push("permission");
    await this.requestPermission(context, {
      reason: "outside-workspace-read",
      display: context.input.value,
    });
  }

  protected override async run(
    _context: ToolExecutionContext<TestInput, TestDetails>,
  ): Promise<AgentToolResult<TestDetails>> {
    this.events.push("run");
    if (this.runError !== undefined) throw this.runError;
    return this.buildResponse([{ type: "text", text: "ok" }], {
      msg: "ok",
      kind: "read",
    });
  }
}

function runtime(overrides: Partial<ToolRuntimeOptions> = {}): ToolRuntimeOptions {
  return {
    cwd: process.cwd(),
    permissionMode: "request-approval",
    requestApproval: async () => "allow",
    ...overrides,
  };
}

describe("ToolBase", () => {
  it("runs schema validation, semantic validation, permission, and execution in order", async () => {
    const requestApproval = vi.fn(async () => "allow" as const);
    const tool = new TestTool(runtime({ requestApproval }));

    await expect(tool.execute("test-call", { value: "target" })).resolves.toEqual({
      content: [{ type: "text", text: "ok" }],
      details: { msg: "ok", kind: "read" },
    });
    expect(tool.events).toEqual(["params", "permission", "run"]);
    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: "test-call",
        toolName: "read",
        input: { value: "target" },
        reason: "outside-workspace-read",
        display: "target",
        permissionMode: "request-approval",
      }),
      undefined,
    );
  });

  it("rejects invalid schema input before custom validation and permission", async () => {
    const requestApproval = vi.fn(async () => "allow" as const);
    const tool = new TestTool(runtime({ requestApproval }));

    await expect(tool.execute("invalid-schema", {} as never)).rejects.toThrow(
      "Invalid parameters for read: / must have required properties value",
    );
    expect(tool.events).toEqual([]);
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it("stops after semantic or permission validation failures", async () => {
    const requestApproval = vi.fn(async () => "deny" as const);
    const invalidTool = new TestTool(runtime({ requestApproval }));
    await expect(invalidTool.execute("invalid", { value: "invalid" })).rejects.toThrow(
      "semantic validation failed",
    );
    expect(invalidTool.events).toEqual(["params"]);
    expect(requestApproval).not.toHaveBeenCalled();

    const deniedTool = new TestTool(runtime({ requestApproval }));
    await expect(deniedTool.execute("denied", { value: "target" })).rejects.toThrow(
      "Permission denied for read",
    );
    expect(deniedTool.events).toEqual(["params", "permission"]);
  });

  it("preserves Error instances and normalizes non-Error failures", async () => {
    const original = new Error("original failure");
    const errorTool = new TestTool(runtime());
    errorTool.runError = original;
    await expect(errorTool.execute("error", { value: "target" })).rejects.toBe(original);

    const primitiveTool = new TestTool(runtime());
    primitiveTool.runError = "primitive failure";
    await expect(primitiveTool.execute("primitive", { value: "target" })).rejects.toEqual(
      new Error("primitive failure"),
    );
  });

  it("rejects an aborted call before validation", async () => {
    const controller = new AbortController();
    controller.abort();
    const tool = new TestTool(runtime());

    await expect(tool.execute("aborted", { value: "target" }, controller.signal)).rejects.toThrow(
      "Operation aborted",
    );
    expect(tool.events).toEqual([]);
  });
});
