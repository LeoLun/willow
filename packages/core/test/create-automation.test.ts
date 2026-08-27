import { describe, expect, it, vi } from "vitest";
import {
  createCreateAutomationTool,
  type CreateAutomationHandler,
  type ToolApprovalHandler,
} from "../src/index.js";

const cwd = process.cwd();

function approvalHandler(decision: "allow" | "deny" = "allow") {
  return vi.fn<ToolApprovalHandler>(async () => decision);
}

const validInput = {
  title: "每日审查",
  prompt: "请审查今天的代码变更",
  cronExpression: "0 9 * * 1-5",
  timezone: "Asia/Shanghai",
};

describe("createAutomation tool", () => {
  it("creates an automation directly and reports the result", async () => {
    const requestApproval = approvalHandler();
    const createAutomation = vi.fn<CreateAutomationHandler>(async () => ({
      ok: true,
      automationId: 42,
      title: "每日审查",
      cronExpression: "0 9 * * 1-5",
    }));
    const tool = createCreateAutomationTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
      createAutomation,
    });

    const result = await tool.execute("call-1", validInput);

    expect(requestApproval).not.toHaveBeenCalled();
    expect(createAutomation).toHaveBeenCalledWith(validInput);
    expect(result.content).toEqual([
      { type: "text", text: expect.stringContaining("定时任务已创建") as string },
    ]);
    expect(result.details).toMatchObject({
      kind: "createAutomation",
      automationId: 42,
      title: "每日审查",
      cronExpression: "0 9 * * 1-5",
    });
  });

  it("does not consult the approval handler in request-approval mode", async () => {
    const requestApproval = approvalHandler("deny");
    const createAutomation = vi.fn<CreateAutomationHandler>(async () => ({
      ok: true,
      automationId: 1,
      title: "x",
      cronExpression: "0 9 * * *",
    }));
    const tool = createCreateAutomationTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
      createAutomation,
    });

    await expect(tool.execute("call-1", validInput)).resolves.toBeDefined();
    expect(requestApproval).not.toHaveBeenCalled();
    expect(createAutomation).toHaveBeenCalledOnce();
  });

  it("does not consult the approval handler in delegate-approval mode", async () => {
    const requestApproval = approvalHandler("allow");
    const createAutomation = vi.fn<CreateAutomationHandler>(async () => ({
      ok: true,
      automationId: 7,
      title: "x",
      cronExpression: "0 * * * *",
    }));
    const tool = createCreateAutomationTool({
      cwd,
      permissionMode: "delegate-approval",
      requestApproval,
      createAutomation,
    });

    const result = await tool.execute("call-2", { ...validInput, cronExpression: "0 * * * *" });
    expect(requestApproval).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({ automationId: 7 });
  });

  it("runs without approval in full-access mode", async () => {
    const requestApproval = approvalHandler();
    const createAutomation = vi.fn<CreateAutomationHandler>(async () => ({
      ok: true,
      automationId: 9,
      title: "x",
      cronExpression: "0 9 * * *",
    }));
    const tool = createCreateAutomationTool({
      cwd,
      permissionMode: "full-access",
      requestApproval,
      createAutomation,
    });

    const result = await tool.execute("call-3", validInput);
    expect(requestApproval).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({ automationId: 9 });
  });

  it("fails safely when no handler is injected", async () => {
    const tool = createCreateAutomationTool({
      cwd,
      permissionMode: "full-access",
    });

    await expect(tool.execute("call-4", validInput)).rejects.toThrow(/不可用/);
  });

  it("surfaces host-side creation errors", async () => {
    const createAutomation = vi.fn<CreateAutomationHandler>(async () => ({
      ok: false,
      error: "cron 表达式无效。",
    }));
    const tool = createCreateAutomationTool({
      cwd,
      permissionMode: "full-access",
      createAutomation,
    });

    await expect(tool.execute("call-5", validInput)).rejects.toThrow("cron 表达式无效。");
  });

  it("validates parameters before permission checks", async () => {
    const requestApproval = approvalHandler();
    const createAutomation: CreateAutomationHandler = vi.fn();
    const tool = createCreateAutomationTool({
      cwd,
      permissionMode: "request-approval",
      requestApproval,
      createAutomation,
    });

    const invalidCases = [
      { ...validInput, prompt: "   " },
      { ...validInput, cronExpression: "" },
      { ...validInput, title: "  " },
      { ...validInput, timezone: "" },
      { ...validInput, model: { providerId: "openai", modelId: "" } },
      {} as never,
    ];
    for (const input of invalidCases) {
      await expect(tool.execute("call-invalid", input)).rejects.toThrow();
    }
    expect(requestApproval).not.toHaveBeenCalled();
    expect(createAutomation).not.toHaveBeenCalled();
  });

  it("aborts before creating the automation", async () => {
    const controller = new AbortController();
    controller.abort();
    const createAutomation: CreateAutomationHandler = vi.fn();
    const tool = createCreateAutomationTool({
      cwd,
      permissionMode: "full-access",
      createAutomation,
    });

    await expect(tool.execute("call-abort", validInput, controller.signal)).rejects.toThrow(
      /abort|Abort/i,
    );
    expect(createAutomation).not.toHaveBeenCalled();
  });
});
