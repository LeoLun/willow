import { describe, expect, it, vi } from "vitest";
import {
  createDeleteAutomationTool,
  createListAutomationsTool,
  createUpdateAutomationTool,
  type DeleteAutomationHandler,
  type ListAutomationsHandler,
  type ToolApprovalHandler,
  type ToolApprovalRequest,
  type UpdateAutomationHandler,
} from "../src/index.js";

const cwd = process.cwd();

function approvalHandler(decision: "allow" | "deny" = "allow") {
  return vi.fn<ToolApprovalHandler>(async () => decision);
}

describe("listAutomations tool", () => {
  it("lists current-workspace automations without approval", async () => {
    const requestApproval = approvalHandler();
    const listAutomations = vi.fn<ListAutomationsHandler>(async () => ({
      ok: true,
      automations: [
        {
          automationId: 3,
          title: "日报",
          prompt: "整理日报",
          status: "enabled",
          cronExpression: "0 18 * * 1-5",
          timezone: "Asia/Shanghai",
        },
      ],
    }));
    const tool = createListAutomationsTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
      listAutomations,
    });

    const result = await tool.execute("list-1", {});

    expect(requestApproval).not.toHaveBeenCalled();
    expect(listAutomations).toHaveBeenCalledWith({});
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("日报"),
    });
    expect(result.details).toMatchObject({ kind: "listAutomations", automationCount: 1 });
  });

  it("reports an empty workspace and host errors", async () => {
    const empty = createListAutomationsTool({
      cwd,
      permissionMode: "full-access",
      listAutomations: async () => ({ ok: true, automations: [] }),
    });
    const result = await empty.execute("list-empty", {});
    expect(result.content).toEqual([{ type: "text", text: "当前工作空间没有自动化。" }]);

    const failed = createListAutomationsTool({
      cwd,
      permissionMode: "full-access",
      listAutomations: async () => ({ ok: false, error: "读取失败" }),
    });
    await expect(failed.execute("list-failed", {})).rejects.toThrow("读取失败");
  });

  it("fails safely when the handler is unavailable or the call is aborted", async () => {
    const missing = createListAutomationsTool({ cwd, permissionMode: "full-access" });
    await expect(missing.execute("list-missing", {})).rejects.toThrow(/不可用/);

    const controller = new AbortController();
    controller.abort();
    const listAutomations: ListAutomationsHandler = vi.fn();
    const aborted = createListAutomationsTool({
      cwd,
      permissionMode: "full-access",
      listAutomations,
    });
    await expect(aborted.execute("list-abort", {}, controller.signal)).rejects.toThrow(
      /abort|Abort/i,
    );
    expect(listAutomations).not.toHaveBeenCalled();
  });
});

describe("updateAutomation tool", () => {
  const input = { automationId: 7, cronExpression: "0 10 * * *", status: "disabled" as const };

  function successfulHandler() {
    return vi.fn<UpdateAutomationHandler>(async () => ({
      ok: true,
      automationId: 7,
      title: "日报",
      status: "disabled",
      cronExpression: "0 10 * * *",
      timezone: "Asia/Shanghai",
    }));
  }

  it("updates after approval and reports the changed automation", async () => {
    const requestApproval = approvalHandler();
    const updateAutomation = successfulHandler();
    const tool = createUpdateAutomationTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
      updateAutomation,
    });

    const result = await tool.execute("update-1", input);

    const request = requestApproval.mock.calls[0]?.[0] as ToolApprovalRequest;
    expect(request).toMatchObject({
      toolCallId: "update-1",
      toolName: "updateAutomation",
      reason: "automation-update",
    });
    expect(request.display).toContain("#7");
    expect(request.display).toContain("0 10 * * *");
    expect(updateAutomation).toHaveBeenCalledWith(input);
    expect(result.details).toMatchObject({
      kind: "updateAutomation",
      automationId: 7,
      status: "disabled",
    });
  });

  it.each(["request-approval", "delegate-approval"] as const)(
    "does not update when %s approval is denied",
    async (permissionMode) => {
      const updateAutomation = successfulHandler();
      const tool = createUpdateAutomationTool({
        cwd,
        permissionMode,
        requestApproval: approvalHandler("deny"),
        updateAutomation,
      });
      await expect(tool.execute("update-denied", input)).rejects.toThrow(/denied|拒绝/i);
      expect(updateAutomation).not.toHaveBeenCalled();
    },
  );

  it("uses delegated approval and skips approval in full-access mode", async () => {
    const delegatedApproval = approvalHandler();
    const delegated = createUpdateAutomationTool({
      cwd,
      permissionMode: "delegate-approval",
      requestApproval: delegatedApproval,
      updateAutomation: successfulHandler(),
    });
    await delegated.execute("update-delegated", input);
    expect(delegatedApproval).toHaveBeenCalledTimes(1);

    const fullApproval = approvalHandler();
    const full = createUpdateAutomationTool({
      cwd,
      permissionMode: "full-access",
      requestApproval: fullApproval,
      updateAutomation: successfulHandler(),
    });
    await full.execute("update-full", input);
    expect(fullApproval).not.toHaveBeenCalled();
  });

  it("validates input before approval", async () => {
    const requestApproval = approvalHandler();
    const updateAutomation: UpdateAutomationHandler = vi.fn();
    const tool = createUpdateAutomationTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
      updateAutomation,
    });
    const invalidInputs = [
      { automationId: 0, title: "x" },
      { automationId: 1 },
      { automationId: 1, title: "  " },
      { automationId: 1, prompt: "" },
      { automationId: 1, timezone: "" },
      { automationId: 1, model: { providerId: "openai", modelId: "" } },
      { automationId: 1, unknown: true },
    ];
    for (const invalidInput of invalidInputs) {
      await expect(tool.execute("update-invalid", invalidInput as never)).rejects.toThrow();
    }
    expect(requestApproval).not.toHaveBeenCalled();
    expect(updateAutomation).not.toHaveBeenCalled();
  });

  it("supports clearing the model and surfaces availability and host errors", async () => {
    const updateAutomation = vi.fn<UpdateAutomationHandler>(async () => ({
      ok: false,
      error: "模型不可用",
    }));
    const failed = createUpdateAutomationTool({
      cwd,
      permissionMode: "full-access",
      updateAutomation,
    });
    await expect(failed.execute("update-model", { automationId: 1, model: null })).rejects.toThrow(
      "模型不可用",
    );
    expect(updateAutomation).toHaveBeenCalledWith({ automationId: 1, model: null });

    const missing = createUpdateAutomationTool({ cwd, permissionMode: "full-access" });
    await expect(missing.execute("update-missing", input)).rejects.toThrow(/不可用/);
  });

  it("does not update an aborted call", async () => {
    const controller = new AbortController();
    controller.abort();
    const updateAutomation: UpdateAutomationHandler = vi.fn();
    const tool = createUpdateAutomationTool({
      cwd,
      permissionMode: "full-access",
      updateAutomation,
    });
    await expect(tool.execute("update-abort", input, controller.signal)).rejects.toThrow(
      /abort|Abort/i,
    );
    expect(updateAutomation).not.toHaveBeenCalled();
  });
});

describe("deleteAutomation tool", () => {
  function successfulHandler() {
    return vi.fn<DeleteAutomationHandler>(async () => ({
      ok: true,
      automationId: 9,
      title: "日报",
    }));
  }

  it("deletes after approval and describes the destructive scope", async () => {
    const requestApproval = approvalHandler();
    const deleteAutomation = successfulHandler();
    const tool = createDeleteAutomationTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
      deleteAutomation,
    });

    const result = await tool.execute("delete-1", { automationId: 9 });

    const request = requestApproval.mock.calls[0]?.[0] as ToolApprovalRequest;
    expect(request).toMatchObject({
      toolCallId: "delete-1",
      toolName: "deleteAutomation",
      reason: "automation-delete",
    });
    expect(request.display).toContain("执行历史");
    expect(request.display).toContain("聊天会话");
    expect(result.details).toMatchObject({ kind: "deleteAutomation", automationId: 9 });
  });

  it.each(["request-approval", "delegate-approval"] as const)(
    "does not delete when %s approval is denied",
    async (permissionMode) => {
      const deleteAutomation = successfulHandler();
      const tool = createDeleteAutomationTool({
        cwd,
        permissionMode,
        requestApproval: approvalHandler("deny"),
        deleteAutomation,
      });
      await expect(tool.execute("delete-denied", { automationId: 9 })).rejects.toThrow(
        /denied|拒绝/i,
      );
      expect(deleteAutomation).not.toHaveBeenCalled();
    },
  );

  it("skips approval in full-access mode and surfaces host errors", async () => {
    const requestApproval = approvalHandler();
    const full = createDeleteAutomationTool({
      cwd,
      permissionMode: "full-access",
      requestApproval,
      deleteAutomation: successfulHandler(),
    });
    await full.execute("delete-full", { automationId: 9 });
    expect(requestApproval).not.toHaveBeenCalled();

    const failed = createDeleteAutomationTool({
      cwd,
      permissionMode: "full-access",
      deleteAutomation: async () => ({ ok: false, error: "正在运行" }),
    });
    await expect(failed.execute("delete-failed", { automationId: 9 })).rejects.toThrow("正在运行");
  });

  it("validates input and fails safely without a handler", async () => {
    const requestApproval = approvalHandler();
    const deleteAutomation: DeleteAutomationHandler = vi.fn();
    const invalid = createDeleteAutomationTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
      deleteAutomation,
    });
    for (const input of [{ automationId: 0 }, { automationId: 1.5 }, { automationId: 1, x: 1 }]) {
      await expect(invalid.execute("delete-invalid", input as never)).rejects.toThrow();
    }
    expect(requestApproval).not.toHaveBeenCalled();
    expect(deleteAutomation).not.toHaveBeenCalled();

    const missing = createDeleteAutomationTool({ cwd, permissionMode: "full-access" });
    await expect(missing.execute("delete-missing", { automationId: 1 })).rejects.toThrow(/不可用/);
  });

  it("does not delete an aborted call", async () => {
    const controller = new AbortController();
    controller.abort();
    const deleteAutomation: DeleteAutomationHandler = vi.fn();
    const tool = createDeleteAutomationTool({
      cwd,
      permissionMode: "full-access",
      deleteAutomation,
    });
    await expect(
      tool.execute("delete-abort", { automationId: 1 }, controller.signal),
    ).rejects.toThrow(/abort|Abort/i);
    expect(deleteAutomation).not.toHaveBeenCalled();
  });
});
