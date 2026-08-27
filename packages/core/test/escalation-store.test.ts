import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { EscalationStore, createBashTool, type ToolApprovalHandler } from "../src/index.js";

const violation = { type: "filesystem-write" as const, path: "/outside", message: "deny write" };

describe("EscalationStore", () => {
  it("binds a token to session store, command, canonical cwd, and one use", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "willow-escalation-"));
    const store = new EscalationStore("session");
    const token = store.create("printf ok", cwd, [violation]);
    expect(store.validate(token, "printf ok", join(cwd, "."))).toEqual([violation]);
    expect(store.validate(token, "printf changed", cwd)).toBeUndefined();
    expect(new EscalationStore("other").validate(token, "printf ok", cwd)).toBeUndefined();
    store.consume(token);
    expect(store.validate(token, "printf ok", cwd)).toBeUndefined();
  });

  it("expires tokens after five minutes", async () => {
    vi.useFakeTimers();
    try {
      const store = new EscalationStore("session");
      const token = store.create("pwd", process.cwd(), [violation]);
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(store.validate(token, "pwd", process.cwd())).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("requires human-only review and executes an approved token once", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "willow-elevated-"));
    const store = new EscalationStore("session");
    const token = store.create("printf elevated", cwd, [violation]);
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "allow");
    const tool = createBashTool({
      cwd,
      sessionId: "session",
      permissionMode: "delegate-approval",
      escalationStore: store,
      requestApproval,
    });
    const input = {
      command: "printf elevated",
      sandboxPermissions: "elevated" as const,
      escalationToken: token,
      justification: "The sandbox blocked the required output location.",
    };
    const result = await tool.execute("elevated", input);
    expect(result.content).toEqual([{ type: "text", text: "elevated" }]);
    expect(requestApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "sandbox-denied",
        autoReviewable: false,
        risk: "high",
      }),
      undefined,
    );
    await expect(tool.execute("reused", input)).rejects.toThrow(
      "Invalid or expired sandbox escalation token",
    );
  });

  it("still requires explicit human approval after switching to full-access", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "willow-elevated-full-"));
    const store = new EscalationStore("session");
    const token = store.create("printf full", cwd, [violation]);
    const requestApproval = vi.fn<ToolApprovalHandler>(async () => "deny");
    const tool = createBashTool({
      cwd,
      sessionId: "session",
      permissionMode: "full-access",
      escalationStore: store,
      requestApproval,
    });
    await expect(
      tool.execute("full-human", {
        command: "printf full",
        sandboxPermissions: "elevated",
        escalationToken: token,
        justification: "The earlier sandbox denied this exact command.",
      }),
    ).rejects.toThrow("Permission denied");
    expect(requestApproval).toHaveBeenCalledOnce();
  });
});
