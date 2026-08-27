import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DefaultPermissionEngine,
  TOOL_NAMES,
  analyzeCommand,
  createListAutomationsTool,
  normalizeApprovalAction,
  type PermissionDecision,
  type PermissionEngine,
  type ToolName,
} from "../src/index.js";

function reviewDecision(autoReviewable = true): PermissionDecision {
  return {
    action: "review",
    risk: "medium",
    ruleId: "test.review",
    reason: { type: "test.review", message: "Review required." },
    autoReviewable,
  };
}

describe("DefaultPermissionEngine", () => {
  it("has an explicit policy for every built-in tool", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "willow-policy-"));
    const engine = new DefaultPermissionEngine();
    for (const toolName of TOOL_NAMES) {
      const input = inputFor(toolName);
      const result = await engine.evaluate({
        sessionId: "session",
        toolCallId: `call-${toolName}`,
        toolName,
        input,
        workspaceRoot: cwd,
        action: normalizeApprovalAction(toolName, input, { cwd }),
      });
      expect(result.ruleId, toolName).not.toBe("tool.unregistered-policy");
    }
  });

  it("fails closed for an unregistered tool", async () => {
    const engine = new DefaultPermissionEngine([]);
    const result = await engine.evaluate({
      sessionId: "session",
      toolCallId: "unknown",
      toolName: "unknown" as ToolName,
      input: {},
      workspaceRoot: process.cwd(),
      action: { type: "internal", capability: "unknown" },
    });
    expect(result).toMatchObject({ action: "deny", ruleId: "tool.unregistered-policy" });
  });

  it("hard-denies sensitive resources and dangerous commands", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "willow-hard-deny-"));
    const engine = new DefaultPermissionEngine();
    const sensitive = await engine.evaluate({
      sessionId: "session",
      toolCallId: "read-secret",
      toolName: "read",
      input: { path: ".env.local" },
      workspaceRoot: cwd,
      action: { type: "filesystem", operation: "read", paths: [".env.local"], cwd },
    });
    const sudo = await engine.evaluate({
      sessionId: "session",
      toolCallId: "sudo",
      toolName: "bash",
      input: { command: "sudo true" },
      workspaceRoot: cwd,
      action: {
        type: "exec",
        command: "sudo true",
        cwd,
        interactive: false,
        sandboxPermissions: "default",
      },
    });
    expect(sensitive.action).toBe("deny");
    expect(sudo).toMatchObject({ action: "deny", risk: "critical" });
  });

  it("classifies safe, risky, compound, and substituted commands", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "willow-command-policy-"));
    const engine = new DefaultPermissionEngine();
    const evaluate = async (command: string) =>
      await engine.evaluate({
        sessionId: "session",
        toolCallId: command,
        toolName: "bash",
        input: { command },
        workspaceRoot: cwd,
        action: {
          type: "exec",
          command,
          cwd,
          interactive: false,
          sandboxPermissions: "default",
        },
      });

    await expect(evaluate("git status && pwd")).resolves.toMatchObject({ action: "allow" });
    await expect(evaluate("ls | cat")).resolves.toMatchObject({ action: "allow" });
    await expect(evaluate("ls | rm file")).resolves.toMatchObject({ action: "review" });
    await expect(evaluate("pnpm install")).resolves.toMatchObject({ action: "review" });
    await expect(evaluate("pnpm --filter @willow/core test")).resolves.toMatchObject({
      action: "allow",
    });
    await expect(evaluate("git branch feature")).resolves.toMatchObject({ action: "review" });
    await expect(evaluate("find . -delete")).resolves.toMatchObject({ action: "review" });
    await expect(evaluate("sed -i s/a/b/ file")).resolves.toMatchObject({ action: "review" });
    await expect(evaluate("printf x > file")).resolves.toMatchObject({ action: "review" });
    await expect(evaluate("echo $(pwd)")).resolves.toMatchObject({ action: "review" });

    expect(analyzeCommand("git status | rg clean")).toMatchObject({
      commands: ["git status", "rg clean"],
      hasPipe: true,
      gitWrite: false,
    });
  });
});

describe("permission mode routing", () => {
  it.each(["request-approval", "delegate-approval"] as const)(
    "routes REVIEW to the host in %s mode",
    async (permissionMode) => {
      const requestApproval = vi.fn(async () => "allow" as const);
      const listAutomations = vi.fn(async () => ({ ok: true as const, automations: [] }));
      const permissionEngine: PermissionEngine = { evaluate: async () => reviewDecision() };
      const tool = createListAutomationsTool({
        cwd: process.cwd(),
        permissionMode,
        permissionEngine,
        requestApproval,
        listAutomations,
      });
      await expect(tool.execute("review", {})).resolves.toBeDefined();
      expect(requestApproval).toHaveBeenCalledWith(
        expect.objectContaining({ permissionMode, autoReviewable: true }),
        undefined,
      );
      expect(listAutomations).toHaveBeenCalledOnce();
    },
  );

  it("auto-accepts REVIEW but never DENY in full-access mode", async () => {
    const requestApproval = vi.fn(async () => "allow" as const);
    const listAutomations = vi.fn(async () => ({ ok: true as const, automations: [] }));
    const reviewEngine: PermissionEngine = { evaluate: async () => reviewDecision() };
    const reviewTool = createListAutomationsTool({
      cwd: process.cwd(),
      permissionMode: "full-access",
      permissionEngine: reviewEngine,
      requestApproval,
      listAutomations,
    });
    await expect(reviewTool.execute("review", {})).resolves.toBeDefined();
    expect(requestApproval).not.toHaveBeenCalled();

    const denyEngine: PermissionEngine = {
      evaluate: async () => ({
        action: "deny",
        risk: "critical",
        ruleId: "test.deny",
        reason: { type: "test.deny", message: "Denied." },
      }),
    };
    const deniedHandler = vi.fn(async () => ({ ok: true as const, automations: [] }));
    const denyTool = createListAutomationsTool({
      cwd: process.cwd(),
      permissionMode: "full-access",
      permissionEngine: denyEngine,
      requestApproval,
      listAutomations: deniedHandler,
    });
    await expect(denyTool.execute("deny", {})).rejects.toThrow("Permission denied");
    expect(deniedHandler).not.toHaveBeenCalled();
  });
});

function inputFor(toolName: ToolName): Record<string, unknown> {
  if (["read", "ls", "grep", "find", "write", "edit"].includes(toolName)) {
    return { path: "." };
  }
  if (toolName === "bash") return { command: "pwd" };
  if (toolName === "webfetch") return { url: "https://example.com" };
  if (toolName === "websearch") return { query: "Willow" };
  return {};
}
