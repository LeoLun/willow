import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Container } from "inversify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  userDataPath: "",
  appPath: "",
}));

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => electronMocks.userDataPath),
    getAppPath: vi.fn(() => electronMocks.appPath),
  },
}));

import { eq } from "drizzle-orm";
import { automations } from "../src/main/db/schema";
import {
  AutomationNotFoundError,
  AutomationRunningConflictError,
  AutomationService,
  AutomationValidationError,
} from "../src/main/service/automation.service";
import { AutomationRunDao } from "../src/main/service/dao/automation-run.dao.server";
import { AutomationTriggerDao } from "../src/main/service/dao/automation-trigger.dao.server";
import { AutomationDao } from "../src/main/service/dao/automation.dao.server";
import { SessionDao } from "../src/main/service/dao/session.dao.server";
import { WorkspaceDao } from "../src/main/service/dao/workspace.dao.server";
import { DbService } from "../src/main/service/db.service";
import { UnattendedInteractionError } from "../src/main/service/message.service";
import { PermissionModeService } from "../src/main/service/permission-mode.service";
import { toSqliteSessionMetadata } from "../src/main/utils/session-manager";
import type { ModelConfig } from "../src/shared/api";
import { AUTOMATION_CHANGED_EVENT } from "../src/shared/constants";

const appPath = fileURLToPath(new URL("..", import.meta.url));

describe("AutomationService", () => {
  let dbService: DbService;
  let automationDao: AutomationDao;
  let triggerDao: AutomationTriggerDao;
  let runDao: AutomationRunDao;
  let workspaceDao: WorkspaceDao;
  let sessionDao: SessionDao;
  let service: AutomationService;
  let permissionModeService: PermissionModeService;

  const createSession = vi.fn();
  const sendMessage = vi.fn();
  const getModel = vi.fn();
  const getConfig = vi.fn();
  const sendEvent = vi.fn();
  const scheduler = {
    register: vi.fn(),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
    isRegistered: vi.fn(() => false),
  };

  let sessionCounter = 0;

  beforeEach(async () => {
    electronMocks.userDataPath = await mkdtemp(join(tmpdir(), "willow-auto-service-"));
    electronMocks.appPath = appPath;
    sessionCounter = 0;

    const container = new Container({ defaultScope: "Singleton" });
    container.bind(DbService).toSelf();
    container.bind(AutomationDao).toSelf();
    container.bind(AutomationTriggerDao).toSelf();
    container.bind(AutomationRunDao).toSelf();
    container.bind(WorkspaceDao).toSelf();
    container.bind(SessionDao).toSelf();

    dbService = container.get(DbService);
    automationDao = container.get(AutomationDao);
    triggerDao = container.get(AutomationTriggerDao);
    runDao = container.get(AutomationRunDao);
    workspaceDao = container.get(WorkspaceDao);
    sessionDao = container.get(SessionDao);

    createSession.mockReset();
    sendMessage.mockReset();
    getModel.mockReset();
    getConfig.mockReset();
    sendEvent.mockReset();
    scheduler.register.mockReset();
    scheduler.unregister.mockReset();
    scheduler.unregisterAll.mockReset();
    scheduler.isRegistered.mockReset();
    scheduler.isRegistered.mockReturnValue(false);

    createSession.mockImplementation(async (workspaceId: number, options: { title?: string }) => {
      sessionCounter += 1;
      const stored = sessionDao.create({
        workspaceId,
        title: options.title ?? "",
        agentSessionId: `agent-${sessionCounter}`,
      });
      return toSqliteSessionMetadata(stored);
    });
    getConfig.mockReturnValue({ largeModel: { providerId: "openai", modelId: "large" } });
    getModel.mockReturnValue({ id: "model" });

    permissionModeService = new PermissionModeService();
    service = new AutomationService(
      automationDao,
      triggerDao,
      runDao,
      workspaceDao,
      { createSession } as never,
      { sendMessage } as never,
      { getModel } as never,
      { getConfig } as never,
      scheduler as never,
      { sendEvent } as never,
      permissionModeService,
    );
  });

  afterEach(async () => {
    dbService.close();
    await rm(electronMocks.userDataPath, { recursive: true, force: true });
  });

  function createWorkspace(name = "Willow") {
    return workspaceDao.create({ name, path: `/workspace/${name}` });
  }

  function createAutomation(
    workspaceId: number,
    overrides: {
      title?: string;
      prompt?: string;
      status?: "enabled" | "disabled";
      cron?: string;
      timezone?: string;
      model?: ModelConfig;
      lastScheduledAt?: Date;
      createdAt?: Date;
    } = {},
  ) {
    const created = automationDao.createWithTrigger({
      automation: {
        workspaceId,
        title: overrides.title ?? "Daily",
        prompt: overrides.prompt ?? "Run the daily review",
        status: overrides.status ?? "enabled",
        modelProviderId: overrides.model?.providerId ?? null,
        modelId: overrides.model?.modelId ?? null,
      },
      trigger: {
        type: "schedule",
        cronExpression: overrides.cron ?? "0 9 * * *",
        timezone: overrides.timezone ?? "Asia/Shanghai",
        isActive: true,
      },
    });
    if (overrides.lastScheduledAt) {
      automationDao.update(created.id, { lastScheduledAt: overrides.lastScheduledAt });
    }
    if (overrides.createdAt) {
      dbService
        .getDb()
        .update(automations)
        .set({ createdAt: overrides.createdAt })
        .where(eq(automations.id, created.id))
        .run();
    }
    return automationDao.findById(created.id)!;
  }

  function assistantMessage() {
    return {
      role: "assistant",
      content: [{ type: "text", text: "Done" }],
      stopReason: "stop",
    };
  }

  describe("createAutomation", () => {
    it("generates a title from the prompt and registers the schedule", () => {
      const workspace = createWorkspace();
      const created = service.createAutomation({
        workspaceId: workspace.id,
        prompt: "  每天整理工作日志并发送摘要  ",
        trigger: { type: "schedule", cronExpression: "0 9 * * *", timezone: "Asia/Shanghai" },
      });

      expect(created.title).toBe("每天整理工作日志并发送摘要");
      expect(created.prompt).toBe("每天整理工作日志并发送摘要");
      expect(created.status).toBe("enabled");
      expect(created.trigger.cronExpression).toBe("0 9 * * *");
      expect(scheduler.register).toHaveBeenCalledWith(
        created.id,
        "0 9 * * *",
        "Asia/Shanghai",
        expect.any(Function),
      );
      expect(sendEvent).toHaveBeenCalledWith(AUTOMATION_CHANGED_EVENT, {
        automationId: created.id,
        type: "created",
      });
    });

    it("truncates long generated titles", () => {
      const workspace = createWorkspace();
      const longPrompt = "这是一个特别长的提示词用于验证标题截断逻辑是否正确工作";
      const long = service.createAutomation({
        workspaceId: workspace.id,
        prompt: longPrompt,
        trigger: { type: "schedule", cronExpression: "0 9 * * *", timezone: "UTC" },
      });
      expect(long.title.length).toBe(24);
      expect(long.title).toBe(longPrompt.slice(0, 24));
    });

    it("rejects an empty prompt", () => {
      const workspace = createWorkspace();
      expect(() =>
        service.createAutomation({
          workspaceId: workspace.id,
          prompt: "   ",
          title: "自定义标题",
          trigger: { type: "schedule", cronExpression: "0 9 * * *", timezone: "UTC" },
        }),
      ).toThrow(AutomationValidationError);
    });

    it("rejects an invalid workspace", () => {
      expect(() =>
        service.createAutomation({
          workspaceId: 999_999,
          prompt: "hello",
          trigger: { type: "schedule", cronExpression: "0 9 * * *", timezone: "UTC" },
        }),
      ).toThrow(AutomationValidationError);
    });

    it("rejects invalid cron expressions", () => {
      const workspace = createWorkspace();
      for (const cronExpression of ["0 9 * * * *", "60 9 * * *", "0 25 * * *", "abc"]) {
        expect(() =>
          service.createAutomation({
            workspaceId: workspace.id,
            prompt: "hello",
            trigger: { type: "schedule", cronExpression, timezone: "UTC" },
          }),
        ).toThrow(AutomationValidationError);
      }
      expect(automationDao.findAll()).toEqual([]);
    });

    it("rejects invalid timezones and trigger types", () => {
      const workspace = createWorkspace();
      expect(() =>
        service.createAutomation({
          workspaceId: workspace.id,
          prompt: "hello",
          trigger: { type: "schedule", cronExpression: "0 9 * * *", timezone: "Not/AZone" },
        }),
      ).toThrow(AutomationValidationError);
      expect(() =>
        service.createAutomation({
          workspaceId: workspace.id,
          prompt: "hello",
          trigger: {
            type: "unknown" as "schedule",
            cronExpression: "0 9 * * *",
            timezone: "UTC",
          },
        }),
      ).toThrow(AutomationValidationError);
    });

    it("rejects a fixed model that cannot be resolved", () => {
      const workspace = createWorkspace();
      getModel.mockImplementation(() => {
        throw new Error("Unsupported model: openai/none");
      });
      expect(() =>
        service.createAutomation({
          workspaceId: workspace.id,
          prompt: "hello",
          model: { providerId: "openai", modelId: "none" },
          trigger: { type: "schedule", cronExpression: "0 9 * * *", timezone: "UTC" },
        }),
      ).toThrow(AutomationValidationError);
    });

    it("does not register when created disabled", () => {
      const workspace = createWorkspace();
      service.createAutomation({
        workspaceId: workspace.id,
        prompt: "hello",
        status: "disabled",
        trigger: { type: "schedule", cronExpression: "0 9 * * *", timezone: "UTC" },
      });
      expect(scheduler.register).not.toHaveBeenCalled();
    });
  });

  describe("createAutomationFromAgent", () => {
    it("creates and registers an automation in the given workspace", async () => {
      const workspace = createWorkspace("项目A");
      const result = await service.createAutomationFromAgent(
        {
          title: "每日审查",
          prompt: "请审查代码变更",
          cronExpression: "0 9 * * 1-5",
          timezone: "Asia/Shanghai",
        },
        workspace.id,
      );

      expect(result).toMatchObject({ ok: true, title: "每日审查", cronExpression: "0 9 * * 1-5" });
      if (!result.ok) throw new Error("expected ok");
      expect(automationDao.findById(result.automationId)?.workspaceId).toBe(workspace.id);
      expect(automationDao.findById(result.automationId)?.prompt).toBe("请审查代码变更");
      expect(scheduler.register).toHaveBeenCalledWith(
        result.automationId,
        "0 9 * * 1-5",
        "Asia/Shanghai",
        expect.any(Function),
      );
    });

    it("defaults the timezone to the system timezone and follows the default model", async () => {
      const workspace = createWorkspace();
      const result = await service.createAutomationFromAgent(
        { prompt: "汇总进度", cronExpression: "0 8 * * *" },
        workspace.id,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok");
      const created = automationDao.findWithTriggerById(result.automationId)!;
      expect(created.trigger.timezone).toBeTruthy();
      expect(created.modelProviderId).toBeNull();
      expect(sendEvent).toHaveBeenCalledWith(AUTOMATION_CHANGED_EVENT, {
        automationId: result.automationId,
        type: "created",
      });
    });

    it("returns a readable error for invalid cron expressions", async () => {
      const workspace = createWorkspace();
      const result = await service.createAutomationFromAgent(
        { prompt: "x", cronExpression: "0 9 * * * *" },
        workspace.id,
      );
      expect(result).toEqual({ ok: false, error: "cron 表达式必须为 5 段。" });
      expect(automationDao.findAll()).toEqual([]);
    });

    it("returns a readable error for unresolvable fixed models", async () => {
      const workspace = createWorkspace();
      getModel.mockImplementation(() => {
        throw new Error("Unsupported model");
      });
      const result = await service.createAutomationFromAgent(
        {
          prompt: "x",
          cronExpression: "0 9 * * *",
          model: { providerId: "openai", modelId: "none" },
        },
        workspace.id,
      );
      expect(result).toEqual({ ok: false, error: "模型不可用，请重新选择。" });
    });

    it("returns a readable error for a missing workspace", async () => {
      const result = await service.createAutomationFromAgent(
        { prompt: "x", cronExpression: "0 9 * * *" },
        999_999,
      );
      expect(result).toEqual({ ok: false, error: "工作空间不存在。" });
    });
  });

  describe("automation management from Agent", () => {
    it("lists only automations in the current workspace with full business configuration", async () => {
      const workspaceA = createWorkspace("A");
      const workspaceB = createWorkspace("B");
      const automationA = createAutomation(workspaceA.id, {
        title: "A 日报",
        prompt: "整理 A 的日报",
        model: { providerId: "openai", modelId: "large" },
      });
      createAutomation(workspaceB.id, { title: "B 日报" });

      const result = await service.listAutomationsFromAgent(workspaceA.id);

      expect(result).toEqual({
        ok: true,
        automations: [
          {
            automationId: automationA.id,
            title: "A 日报",
            prompt: "整理 A 的日报",
            status: "enabled",
            cronExpression: "0 9 * * *",
            timezone: "Asia/Shanghai",
            model: { providerId: "openai", modelId: "large" },
          },
        ],
      });
    });

    it("updates every exposed field and can restore the default model", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id, {
        model: { providerId: "openai", modelId: "large" },
      });
      scheduler.register.mockClear();

      const result = await service.updateAutomationFromAgent(
        {
          automationId: automation.id,
          title: "新日报",
          prompt: "新的提示词",
          cronExpression: "30 10 * * 1-5",
          timezone: "UTC",
          status: "disabled",
          model: null,
        },
        workspace.id,
      );

      expect(result).toEqual({
        ok: true,
        automationId: automation.id,
        title: "新日报",
        status: "disabled",
        cronExpression: "30 10 * * 1-5",
        timezone: "UTC",
      });
      const stored = automationDao.findWithTriggerById(automation.id)!;
      expect(stored.prompt).toBe("新的提示词");
      expect(stored.modelProviderId).toBeNull();
      expect(stored.modelId).toBeNull();
      expect(scheduler.unregister).toHaveBeenCalledWith(automation.id);
      expect(sendEvent).toHaveBeenCalledWith(AUTOMATION_CHANGED_EVENT, {
        automationId: automation.id,
        type: "updated",
      });
    });

    it("does not reveal or mutate automations from another workspace", async () => {
      const workspaceA = createWorkspace("A");
      const workspaceB = createWorkspace("B");
      const automation = createAutomation(workspaceB.id, { title: "B 日报" });

      await expect(service.listAutomationsFromAgent(workspaceA.id)).resolves.toEqual({
        ok: true,
        automations: [],
      });
      await expect(
        service.updateAutomationFromAgent(
          { automationId: automation.id, title: "越界修改" },
          workspaceA.id,
        ),
      ).resolves.toEqual({ ok: false, error: "当前工作空间中不存在该自动化。" });
      await expect(
        service.deleteAutomationFromAgent({ automationId: automation.id }, workspaceA.id),
      ).resolves.toEqual({ ok: false, error: "当前工作空间中不存在该自动化。" });
      expect(automationDao.findById(automation.id)?.title).toBe("B 日报");
    });

    it("returns readable validation and missing-record errors", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id);

      await expect(
        service.updateAutomationFromAgent(
          { automationId: automation.id, cronExpression: "not-cron" },
          workspace.id,
        ),
      ).resolves.toEqual({ ok: false, error: "cron 表达式必须为 5 段。" });
      await expect(
        service.updateAutomationFromAgent({ automationId: 999_999, title: "x" }, workspace.id),
      ).resolves.toEqual({ ok: false, error: "当前工作空间中不存在该自动化。" });
      await expect(
        service.deleteAutomationFromAgent({ automationId: 999_999 }, workspace.id),
      ).resolves.toEqual({ ok: false, error: "当前工作空间中不存在该自动化。" });
    });

    it("deletes an owned automation and maps the running conflict", async () => {
      const workspace = createWorkspace();
      const deletable = createAutomation(workspace.id, { title: "可删除" });
      await expect(
        service.deleteAutomationFromAgent({ automationId: deletable.id }, workspace.id),
      ).resolves.toEqual({ ok: true, automationId: deletable.id, title: "可删除" });
      expect(automationDao.findById(deletable.id)).toBeUndefined();

      const runningAutomation = createAutomation(workspace.id, { title: "运行中" });
      let releaseExecution!: () => void;
      const gate = new Promise<void>((resolve) => {
        releaseExecution = resolve;
      });
      sendMessage.mockImplementation(() => gate.then(() => assistantMessage()));
      const running = service.runAutomationNow(runningAutomation.id);
      await vi.waitFor(() => {
        expect(runDao.hasRunning(runningAutomation.id)).toBe(true);
      });

      await expect(
        service.deleteAutomationFromAgent({ automationId: runningAutomation.id }, workspace.id),
      ).resolves.toEqual({ ok: false, error: "自动化正在运行，暂时无法删除。" });

      releaseExecution();
      await running;
    });
  });

  describe("updateAutomation", () => {
    it("re-registers on cron or timezone change and unregisters when disabled", () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id);
      scheduler.register.mockClear();

      service.updateAutomation({
        id: automation.id,
        trigger: { cronExpression: "0 10 * * *" },
      });
      expect(scheduler.register).toHaveBeenCalledWith(
        automation.id,
        "0 10 * * *",
        "Asia/Shanghai",
        expect.any(Function),
      );

      service.updateAutomation({ id: automation.id, status: "disabled" });
      expect(scheduler.unregister).toHaveBeenCalledWith(automation.id);
    });

    it("updates title, prompt, workspace, model, and status", () => {
      const workspaceA = createWorkspace("A");
      const workspaceB = createWorkspace("B");
      const automation = createAutomation(workspaceA.id);

      const updated = service.updateAutomation({
        id: automation.id,
        workspaceId: workspaceB.id,
        title: "New title",
        prompt: "New prompt",
        status: "disabled",
        model: { providerId: "openai", modelId: "large" },
      });

      expect(updated.title).toBe("New title");
      expect(updated.prompt).toBe("New prompt");
      expect(updated.status).toBe("disabled");
      expect(updated.workspaceId).toBe(workspaceB.id);
      expect(updated.model).toEqual({ providerId: "openai", modelId: "large" });

      const cleared = service.updateAutomation({ id: automation.id, model: null });
      expect(cleared.model).toBeUndefined();
    });

    it("throws for a missing automation", () => {
      expect(() => service.updateAutomation({ id: 999_999, title: "x" })).toThrow(
        AutomationNotFoundError,
      );
    });
  });

  describe("deleteAutomation", () => {
    it("deletes, unregisters, and emits the deleted event", () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id);
      service.deleteAutomation(automation.id);
      expect(automationDao.findById(automation.id)).toBeUndefined();
      expect(scheduler.unregister).toHaveBeenCalledWith(automation.id);
      expect(sendEvent).toHaveBeenCalledWith(AUTOMATION_CHANGED_EVENT, {
        automationId: automation.id,
        type: "deleted",
      });
    });

    it("rejects deletion while the automation is running", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id);
      let releaseExecution!: () => void;
      const gate = new Promise<void>((resolve) => {
        releaseExecution = resolve;
      });
      sendMessage.mockImplementation(() => gate.then(() => assistantMessage()));

      const running = service.runAutomationNow(automation.id);
      await vi.waitFor(() => {
        expect(runDao.hasRunning(automation.id)).toBe(true);
      });

      expect(() => service.deleteAutomation(automation.id)).toThrow(AutomationRunningConflictError);

      releaseExecution();
      await running;
    });
  });

  describe("runAutomationNow", () => {
    it("creates a session with a proper title and sends the prompt unattended", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id);
      let releaseExecution!: () => void;
      const gate = new Promise<void>((resolve) => {
        releaseExecution = resolve;
      });
      sendMessage.mockImplementation(() => gate.then(() => assistantMessage()));

      const run = await service.runAutomationNow(automation.id);

      // 立即返回运行中的 run（含会话），便于前端跳转；收口在后台完成。
      expect(run.status).toBe("running");
      expect(run.sessionId).toBe("agent-1");
      expect(run.workspaceId).toBe(workspace.id);
      expect(createSession).toHaveBeenCalledWith(workspace.id, {
        title: `[自动化] ${automation.title}`,
      });
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: workspace.id,
          content: automation.prompt,
          model: { providerId: "openai", modelId: "large" },
          interactionMode: "unattended",
        }),
      );
      expect(permissionModeService.get(workspace.id, "agent-1")).toBe("delegate-approval");

      releaseExecution();
      await vi.waitFor(() => {
        expect(runDao.findById(run.id)?.status).toBe("completed");
      });
      const refreshed = automationDao.findById(automation.id)!;
      expect(refreshed.lastRunAt).toBeInstanceOf(Date);
      expect(refreshed.lastCompletedAt).toBeInstanceOf(Date);
      expect(refreshed.lastScheduledAt).toBeNull();
    });

    it("uses the fixed model when configured", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id, {
        model: { providerId: "anthropic", modelId: "claude" },
      });
      sendMessage.mockResolvedValue(assistantMessage());

      await service.runAutomationNow(automation.id);
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ model: { providerId: "anthropic", modelId: "claude" } }),
      );
    });

    it("marks the run failed when no model is available", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id);
      getConfig.mockReturnValue({});

      const run = await service.runAutomationNow(automation.id);

      expect(run.status).toBe("failed");
      expect(run.errorMessage).toContain("默认大模型");
      expect(createSession).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it("records message failures on the run after the background dispatch settles", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id);
      let rejectExecution!: (error: unknown) => void;
      const gate = new Promise<never>((_resolve, reject) => {
        rejectExecution = reject;
      });
      sendMessage.mockImplementation(() => gate);

      const run = await service.runAutomationNow(automation.id);
      // 立即返回运行中的 run，失败在后台收口时记录。
      expect(run.status).toBe("running");
      expect(run.sessionId).toBe("agent-1");

      rejectExecution(new UnattendedInteractionError("AI 审批拒绝：理由"));
      await vi.waitFor(() => {
        const latest = runDao.findById(run.id);
        expect(latest?.status).toBe("failed");
        expect(latest?.errorMessage).toBe("AI 审批拒绝：理由");
      });

      let rejectSecond!: (error: unknown) => void;
      const secondGate = new Promise<never>((_resolve, reject) => {
        rejectSecond = reject;
      });
      sendMessage.mockImplementation(() => secondGate);
      const second = await service.runAutomationNow(automation.id);
      rejectSecond(new Error("sensitive raw tool input: secret-key=abc"));
      await vi.waitFor(() => {
        const latest = runDao.findById(second.id);
        expect(latest?.status).toBe("failed");
        expect(latest?.errorMessage).toBe("自动化执行失败，请稍后重试。");
      });
    });

    it("rejects manual runs of disabled automations", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id, { status: "disabled" });
      await expect(service.runAutomationNow(automation.id)).rejects.toThrow(
        AutomationValidationError,
      );
    });

    it("keeps the automation busy until the background run settles", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id);
      let releaseExecution!: () => void;
      const gate = new Promise<void>((resolve) => {
        releaseExecution = resolve;
      });
      sendMessage.mockImplementation(() => gate.then(() => assistantMessage()));

      const run = await service.runAutomationNow(automation.id);
      expect(run.status).toBe("running");
      expect(run.sessionId).toBe("agent-1");

      // 后台运行期间：删除被拒绝、重复手动触发被拒绝、调度触发被跳过。
      expect(() => service.deleteAutomation(automation.id)).toThrow(AutomationRunningConflictError);
      await expect(service.runAutomationNow(automation.id)).rejects.toThrow(
        AutomationRunningConflictError,
      );
      await service.handleScheduledTrigger(automation.id, new Date("2026-08-08T10:00:00.000Z"));
      const skipped = runDao
        .listByAutomation(automation.id, { limit: 10 })
        .find((item) => item.status === "skipped");
      expect(skipped).toBeDefined();
      expect(createSession).toHaveBeenCalledTimes(1);

      releaseExecution();
      await vi.waitFor(() => {
        expect(runDao.findById(run.id)?.status).toBe("completed");
      });
      // 收口后可以正常删除。
      expect(() => service.deleteAutomation(automation.id)).not.toThrow();
    });
  });

  describe("scheduled triggers and overlap", () => {
    it("runs a scheduled trigger and advances the anchor", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id);
      sendMessage.mockResolvedValue(assistantMessage());

      const scheduledFor = new Date("2026-08-08T09:00:00.000Z");
      await service.handleScheduledTrigger(automation.id, scheduledFor);

      const runs = runDao.listByAutomation(automation.id, { limit: 10 });
      expect(runs).toHaveLength(1);
      expect(runs[0]?.runKind).toBe("scheduled");
      expect(runs[0]?.status).toBe("completed");
      expect(automationDao.findById(automation.id)?.lastScheduledAt).toEqual(scheduledFor);
    });

    it("records a skipped run when the previous execution is still running", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id);
      let releaseExecution!: () => void;
      const gate = new Promise<void>((resolve) => {
        releaseExecution = resolve;
      });
      sendMessage.mockImplementation(() => gate.then(() => assistantMessage()));

      const first = service.handleScheduledTrigger(
        automation.id,
        new Date("2026-08-08T09:00:00.000Z"),
      );
      await vi.waitFor(() => {
        expect(runDao.hasRunning(automation.id)).toBe(true);
      });

      const second = new Date("2026-08-08T10:00:00.000Z");
      await service.handleScheduledTrigger(automation.id, second);

      const skipped = runDao
        .listByAutomation(automation.id, { limit: 10 })
        .find((run) => run.status === "skipped");
      expect(skipped).toBeDefined();
      expect(skipped?.errorMessage).toBe("上一轮仍在执行，本次触发已跳过。");
      expect(automationDao.findById(automation.id)?.lastScheduledAt).toEqual(second);
      expect(createSession).toHaveBeenCalledTimes(1);

      releaseExecution();
      await first;
    });

    it("ignores a trigger for a disabled or deleted automation", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id, { status: "disabled" });
      await service.handleScheduledTrigger(automation.id, new Date("2026-08-08T09:00:00.000Z"));
      expect(createSession).not.toHaveBeenCalled();
      expect(runDao.listByAutomation(automation.id, { limit: 10 })).toEqual([]);
    });
  });

  describe("catch-up", () => {
    it("catches up only the most recent missed schedule point", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-10T10:00:00.000Z"));
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id, {
        cron: "0 9 * * *",
        timezone: "UTC",
        lastScheduledAt: new Date("2026-08-08T09:00:00.000Z"),
      });
      sendMessage.mockResolvedValue(assistantMessage());

      // 漏跑补偿在后台派发，initialize 返回时 run 记录已落地，但收口在后台完成。
      await service.initialize();

      const runs = runDao.listByAutomation(automation.id, { limit: 10 });
      expect(runs).toHaveLength(1);
      expect(runs[0]?.runKind).toBe("catch_up");
      expect(runs[0]?.scheduledFor).toEqual(new Date("2026-08-10T09:00:00.000Z"));
      await vi.waitFor(() => {
        expect(runDao.findById(runs[0]!.id)?.status).toBe("completed");
      });
    });

    it("does not compensate when there is no missed run", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-10T10:00:00.000Z"));
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id, {
        cron: "0 9 * * *",
        timezone: "UTC",
        lastScheduledAt: new Date("2026-08-10T09:00:00.000Z"),
      });
      sendMessage.mockResolvedValue(assistantMessage());

      await service.initialize();
      expect(runDao.listByAutomation(automation.id, { limit: 10 })).toEqual([]);
    });

    it("does not create a phantom catch-up across a DST spring-forward", async () => {
      vi.useFakeTimers();
      // America/New_York springs forward on 2026-03-08 at 02:00 local (2:00 -> 3:00),
      // so 2026-03-08T02:00 does not exist locally.
      vi.setSystemTime(new Date("2026-03-08T12:00:00.000Z"));
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id, {
        cron: "0 2 * * *",
        timezone: "America/New_York",
        // Last handled point: 2026-03-07 02:00 EST == 07:00 UTC. The skipped Mar 8
        // 02:00 must not produce a run for a nonexistent local time.
        lastScheduledAt: new Date("2026-03-07T07:00:00.000Z"),
      });
      sendMessage.mockResolvedValue(assistantMessage());

      await service.initialize();
      expect(runDao.listByAutomation(automation.id, { limit: 10 })).toEqual([]);
    });

    it("catches up the most recent real point across a DST transition", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-08T12:00:00.000Z"));
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id, {
        cron: "0 2 * * *",
        timezone: "America/New_York",
        lastScheduledAt: new Date("2026-03-06T07:00:00.000Z"),
      });
      sendMessage.mockResolvedValue(assistantMessage());

      await service.initialize();

      const runs = runDao.listByAutomation(automation.id, { limit: 10 });
      expect(runs).toHaveLength(1);
      expect(runs[0]?.runKind).toBe("catch_up");
      // The most recent 02:00 in America/New_York before Mar 8 noon is Mar 7 (07:00 UTC).
      expect(runs[0]?.scheduledFor).toEqual(new Date("2026-03-07T07:00:00.000Z"));
    });

    it("uses createdAt as the anchor when nothing was scheduled yet", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-10T10:00:00.000Z"));
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id, {
        cron: "0 9 * * *",
        timezone: "UTC",
        createdAt: new Date("2026-08-10T09:30:00.000Z"),
      });
      sendMessage.mockResolvedValue(assistantMessage());

      await service.initialize();
      // The 09:00 point is before creation time, so no catch-up.
      expect(runDao.listByAutomation(automation.id, { limit: 10 })).toEqual([]);
    });

    it("marks leftover running runs as interrupted at startup", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id, { status: "disabled" });
      runDao.create({
        automationId: automation.id,
        runKind: "scheduled",
        status: "running",
        scheduledFor: new Date("2026-08-08T09:00:00.000Z"),
        triggeredAt: new Date("2026-08-08T09:00:00.000Z"),
        errorMessage: null,
      });

      await service.initialize();

      const runs = runDao.listByAutomation(automation.id, { limit: 10 });
      expect(runs[0]?.status).toBe("interrupted");
      expect(runs[0]?.errorMessage).toBe("应用退出导致运行中断。");
      expect(runs[0]?.finishedAt).toBeInstanceOf(Date);
    });
  });

  describe("history listing", () => {
    it("lists runs with stable pagination and session info", async () => {
      const workspace = createWorkspace();
      const automation = createAutomation(workspace.id);
      const times = [
        new Date("2026-08-08T01:00:00.000Z"),
        new Date("2026-08-08T02:00:00.000Z"),
        new Date("2026-08-08T03:00:00.000Z"),
      ];
      for (const triggeredAt of times) {
        runDao.create({
          automationId: automation.id,
          runKind: "scheduled",
          status: "completed",
          scheduledFor: triggeredAt,
          triggeredAt,
          errorMessage: null,
        });
      }

      const first = service.listAutomationRuns(automation.id, { limit: 2 });
      expect(first.runs.map((run) => run.triggeredAt.getTime())).toEqual([
        times[2].getTime(),
        times[1].getTime(),
      ]);
      expect(first.nextCursor).toBe(first.runs[1]?.id);

      const second = service.listAutomationRuns(automation.id, {
        cursor: first.nextCursor,
        limit: 2,
      });
      expect(second.runs.map((run) => run.triggeredAt.getTime())).toEqual([times[0].getTime()]);
      expect(second.nextCursor).toBeUndefined();
      expect(second.runs[0]?.workspaceId).toBe(workspace.id);
    });

    it("throws for a missing automation", () => {
      expect(() => service.listAutomationRuns(999_999, {})).toThrow(AutomationNotFoundError);
    });
  });

  describe("listAutomations", () => {
    it("includes workspace name, next run, and latest run summary", () => {
      const workspace = createWorkspace("项目A");
      const automation = createAutomation(workspace.id);
      runDao.create({
        automationId: automation.id,
        runKind: "manual",
        status: "failed",
        scheduledFor: null,
        triggeredAt: new Date("2026-08-08T03:00:00.000Z"),
        errorMessage: "boom",
      });

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-08T08:00:00.000Z"));
      const items = service.listAutomations();

      expect(items).toHaveLength(1);
      expect(items[0]?.workspaceName).toBe("项目A");
      expect(items[0]?.lastRun?.status).toBe("failed");
      expect(items[0]?.nextRunAt?.toISOString()).toBe("2026-08-09T01:00:00.000Z");
      expect(items[0]?.cronExpression).toBe("0 9 * * *");
    });
  });
});
