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

import { automationTriggers, automations } from "../src/main/db/schema";
import { AutomationRunDao } from "../src/main/service/dao/automation-run.dao.server";
import { AutomationTriggerDao } from "../src/main/service/dao/automation-trigger.dao.server";
import { AutomationDao } from "../src/main/service/dao/automation.dao.server";
import { SessionDao } from "../src/main/service/dao/session.dao.server";
import { WorkspaceDao } from "../src/main/service/dao/workspace.dao.server";
import { DbService } from "../src/main/service/db.service";

const appPath = fileURLToPath(new URL("..", import.meta.url));

describe("automation DAO layer", () => {
  let dbService: DbService;
  let automationDao: AutomationDao;
  let triggerDao: AutomationTriggerDao;
  let runDao: AutomationRunDao;
  let workspaceDao: WorkspaceDao;
  let sessionDao: SessionDao;

  beforeEach(async () => {
    electronMocks.userDataPath = await mkdtemp(join(tmpdir(), "willow-auto-dao-"));
    electronMocks.appPath = appPath;

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
    overrides: Partial<{
      status: "enabled" | "disabled";
      modelProviderId: string | null;
      modelId: string | null;
    }> = {},
  ) {
    return automationDao.createWithTrigger({
      automation: {
        workspaceId,
        title: "Daily",
        prompt: "Run the daily review",
        status: overrides.status ?? "enabled",
        modelProviderId: overrides.modelProviderId ?? null,
        modelId: overrides.modelId ?? null,
      },
      trigger: {
        type: "schedule",
        cronExpression: "0 9 * * *",
        timezone: "Asia/Shanghai",
        isActive: true,
      },
    });
  }

  it("creates automation and trigger atomically and cascades deletion", () => {
    const workspace = createWorkspace();
    const created = createAutomation(workspace.id);

    expect(created.id).toBeGreaterThan(0);
    expect(created.trigger.automationId).toBe(created.id);
    expect(created.trigger.cronExpression).toBe("0 9 * * *");
    expect(created.trigger.timezone).toBe("Asia/Shanghai");

    expect(automationDao.findById(created.id)?.title).toBe("Daily");
    expect(triggerDao.findByAutomationId(created.id)?.isActive).toBe(true);
    expect(automationDao.findEnabledWithActiveTriggers().map(({ id }) => id)).toEqual([created.id]);

    expect(automationDao.delete(created.id)).toBe(true);
    expect(automationDao.findById(created.id)).toBeUndefined();
    expect(triggerDao.findByAutomationId(created.id)).toBeUndefined();
  });

  it("rolls back the whole transaction when the trigger insert fails", () => {
    const workspace = createWorkspace();
    expect(() =>
      dbService.getDb().transaction((transaction) => {
        const created = transaction
          .insert(automations)
          .values({
            workspaceId: workspace.id,
            title: "Rollback",
            prompt: "prompt",
            status: "enabled",
          })
          .returning()
          .get();
        transaction
          .insert(automationTriggers)
          .values({
            automationId: 999_999,
            type: "schedule",
            cronExpression: "0 9 * * *",
            timezone: "UTC",
            isActive: true,
          })
          .run();
        return created;
      }),
    ).toThrow();
    expect(automationDao.findAll()).toEqual([]);
  });

  it("finds enabled automations only with active triggers", () => {
    const workspace = createWorkspace();
    const enabled = createAutomation(workspace.id);
    createAutomation(workspace.id, { status: "disabled" });
    const inactive = createAutomation(workspace.id);
    triggerDao.update(inactive.id, { isActive: false });

    const enabledList = automationDao.findEnabledWithActiveTriggers();
    expect(enabledList.map(({ id }) => id)).toEqual([enabled.id]);
  });

  it("updates trigger fields independently", () => {
    const workspace = createWorkspace();
    const automation = createAutomation(workspace.id);

    const updated = triggerDao.update(automation.id, {
      cronExpression: "0 10 * * *",
      timezone: "UTC",
    });
    expect(updated?.cronExpression).toBe("0 10 * * *");
    expect(updated?.timezone).toBe("UTC");
    expect(triggerDao.findByAutomationId(automation.id)?.cronExpression).toBe("0 10 * * *");
  });

  it("paginates runs newest-first with a stable cursor", () => {
    const workspace = createWorkspace();
    const automation = createAutomation(workspace.id);
    const times = [
      new Date("2026-08-08T01:00:00.000Z"),
      new Date("2026-08-08T02:00:00.000Z"),
      new Date("2026-08-08T03:00:00.000Z"),
      new Date("2026-08-08T04:00:00.000Z"),
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

    const firstPage = runDao.listByAutomation(automation.id, { limit: 2 });
    expect(firstPage.map((run) => run.triggeredAt.getTime())).toEqual([
      times[3].getTime(),
      times[2].getTime(),
    ]);

    const secondPage = runDao.listByAutomation(automation.id, {
      cursor: firstPage[1]!.id,
      limit: 2,
    });
    expect(secondPage.map((run) => run.triggeredAt.getTime())).toEqual([
      times[1].getTime(),
      times[0].getTime(),
    ]);
    expect(runDao.listByAutomation(automation.id, { cursor: secondPage[1]!.id, limit: 2 })).toEqual(
      [],
    );
  });

  it("exposes the agent session id and nulls it when the session is deleted", () => {
    const workspace = createWorkspace();
    const automation = createAutomation(workspace.id);
    const session = sessionDao.create({
      workspaceId: workspace.id,
      title: "automation session",
      agentSessionId: "agent-1",
    });

    const run = runDao.create({
      automationId: automation.id,
      runKind: "manual",
      status: "running",
      scheduledFor: null,
      triggeredAt: new Date("2026-08-08T05:00:00.000Z"),
      errorMessage: null,
    });
    runDao.updateSessionId(run.id, session.id);

    const listed = runDao.listByAutomation(automation.id, { limit: 10 });
    expect(listed[0]?.agentSessionId).toBe("agent-1");

    sessionDao.delete(session.id);
    const afterDelete = runDao.listByAutomation(automation.id, { limit: 10 });
    expect(afterDelete[0]?.agentSessionId).toBeNull();
  });

  it("marks running runs interrupted and finds the latest run", () => {
    const workspace = createWorkspace();
    const automation = createAutomation(workspace.id);
    const running = runDao.create({
      automationId: automation.id,
      runKind: "scheduled",
      status: "running",
      scheduledFor: new Date("2026-08-08T06:00:00.000Z"),
      triggeredAt: new Date("2026-08-08T06:00:00.000Z"),
      errorMessage: null,
    });
    runDao.create({
      automationId: automation.id,
      runKind: "manual",
      status: "completed",
      scheduledFor: null,
      triggeredAt: new Date("2026-08-08T07:00:00.000Z"),
      errorMessage: null,
    });

    expect(runDao.hasRunning(automation.id)).toBe(true);
    const finishedAt = new Date("2026-08-08T07:30:00.000Z");
    runDao.markAutomationRunningInterrupted(automation.id, finishedAt, "应用退出导致运行中断。");

    expect(runDao.findById(running.id)?.status).toBe("interrupted");
    expect(runDao.findById(running.id)?.finishedAt).toEqual(finishedAt);
    expect(runDao.hasRunning(automation.id)).toBe(false);
    expect(runDao.findLatestByAutomation(automation.id)?.status).toBe("completed");
  });
});
