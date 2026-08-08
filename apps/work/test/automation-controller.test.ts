import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateAutomationController } from "../src/main/controllers/automation/create.automation.controller";
import { DeleteAutomationController } from "../src/main/controllers/automation/delete.automation.controller";
import { GetAutomationListController } from "../src/main/controllers/automation/get-list.automation.controller";
import { GetAutomationController } from "../src/main/controllers/automation/get.automation.controller";
import { ListAutomationRunsController } from "../src/main/controllers/automation/list-runs.automation.controller";
import { RunAutomationNowController } from "../src/main/controllers/automation/run-now.automation.controller";
import { UpdateAutomationController } from "../src/main/controllers/automation/update.automation.controller";
import {
  AutomationNotFoundError,
  AutomationRunningConflictError,
  AutomationService,
} from "../src/main/service/automation.service";
import type {
  AutomationInfo,
  AutomationRunInfo,
  AutomationListItem,
  ListAutomationRunsResponse,
  RunAutomationNowResponse,
} from "../src/shared/api";

const event = undefined as unknown as Electron.IpcMainInvokeEvent;

const automation: AutomationInfo = {
  id: 1,
  workspaceId: 1,
  title: "Daily",
  prompt: "Run the daily review",
  status: "enabled",
  createdAt: new Date("2026-08-08T00:00:00.000Z"),
  updatedAt: new Date("2026-08-08T00:00:00.000Z"),
  trigger: {
    id: 1,
    automationId: 1,
    type: "schedule",
    cronExpression: "0 9 * * *",
    timezone: "Asia/Shanghai",
    isActive: true,
    createdAt: new Date("2026-08-08T00:00:00.000Z"),
    updatedAt: new Date("2026-08-08T00:00:00.000Z"),
  },
};

const run: AutomationRunInfo = {
  id: 10,
  automationId: 1,
  workspaceId: 1,
  sessionId: "agent-1",
  runKind: "manual",
  status: "completed",
  triggeredAt: new Date("2026-08-08T01:00:00.000Z"),
  finishedAt: new Date("2026-08-08T01:00:05.000Z"),
  createdAt: new Date("2026-08-08T01:00:00.000Z"),
  updatedAt: new Date("2026-08-08T01:00:05.000Z"),
};

describe("automation controllers", () => {
  const listAutomations = vi.fn<AutomationService["listAutomations"]>();
  const getAutomation = vi.fn<AutomationService["getAutomation"]>();
  const createAutomation = vi.fn<AutomationService["createAutomation"]>();
  const updateAutomation = vi.fn<AutomationService["updateAutomation"]>();
  const deleteAutomation = vi.fn<AutomationService["deleteAutomation"]>();
  const runAutomationNow = vi.fn<AutomationService["runAutomationNow"]>();
  const listAutomationRuns = vi.fn<AutomationService["listAutomationRuns"]>();
  const automationService = {
    listAutomations,
    getAutomation,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    runAutomationNow,
    listAutomationRuns,
  } as unknown as AutomationService;

  const listController = new GetAutomationListController(automationService);
  const getController = new GetAutomationController(automationService);
  const createController = new CreateAutomationController(automationService);
  const updateController = new UpdateAutomationController(automationService);
  const deleteController = new DeleteAutomationController(automationService);
  const runNowController = new RunAutomationNowController(automationService);
  const listRunsController = new ListAutomationRunsController(automationService);

  beforeEach(() => {
    listAutomations.mockReset();
    getAutomation.mockReset();
    createAutomation.mockReset();
    updateAutomation.mockReset();
    deleteAutomation.mockReset();
    runAutomationNow.mockReset();
    listAutomationRuns.mockReset();
  });

  it("lists automations", async () => {
    const item = { id: 1 } as AutomationListItem;
    listAutomations.mockReturnValueOnce([item]);
    await expect(listController.run(event, {})).resolves.toEqual({
      code: 0,
      data: { automations: [item] },
      msg: "ok",
    });
    expect(listAutomations).toHaveBeenCalledTimes(1);
  });

  it("gets a single automation", async () => {
    getAutomation.mockReturnValueOnce(automation);
    await expect(getController.run(event, { id: 1 })).resolves.toEqual({
      code: 0,
      data: { automation },
      msg: "ok",
    });
    expect(getAutomation).toHaveBeenCalledWith(1);
  });

  it("rejects an invalid id without calling the service", async () => {
    for (const id of [0, -1, 1.5, "1"]) {
      const response = await getController.run(event, { id: id as number });
      expect(response.code).toBe(400);
      expect(getAutomation).not.toHaveBeenCalled();
    }
  });

  it("creates an automation", async () => {
    createAutomation.mockReturnValueOnce(automation);
    const response = await createController.run(event, {
      workspaceId: 1,
      prompt: "Run the daily review",
      trigger: { type: "schedule", cronExpression: "0 9 * * *", timezone: "Asia/Shanghai" },
    });
    expect(response.code).toBe(0);
    expect(createAutomation).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid create payloads without calling the service", async () => {
    const cases = [
      {},
      {
        workspaceId: 0,
        prompt: "x",
        trigger: { type: "schedule", cronExpression: "0 9 * * *", timezone: "UTC" },
      },
      {
        workspaceId: 1,
        prompt: "",
        trigger: { type: "schedule", cronExpression: "0 9 * * *", timezone: "UTC" },
      },
      {
        workspaceId: 1,
        prompt: "x",
        trigger: { type: "event", cronExpression: "0 9 * * *", timezone: "UTC" },
      },
      { workspaceId: 1, prompt: "x", trigger: { type: "schedule", cronExpression: "0 9 * * *" } },
      { workspaceId: 1, prompt: "x", trigger: null },
      {
        workspaceId: 1,
        prompt: "x",
        model: { providerId: "" },
        trigger: { type: "schedule", cronExpression: "0 9 * * *", timezone: "UTC" },
      },
      {
        workspaceId: 1,
        prompt: "x",
        status: "paused",
        trigger: { type: "schedule", cronExpression: "0 9 * * *", timezone: "UTC" },
      },
    ];
    for (const request of cases) {
      const response = await createController.run(event, request as never);
      expect(response.code).toBe(400);
    }
    expect(createAutomation).not.toHaveBeenCalled();
  });

  it("updates an automation", async () => {
    updateAutomation.mockReturnValueOnce({ ...automation, title: "Renamed" });
    const response = await updateController.run(event, { id: 1, title: "Renamed" });
    expect(response.code).toBe(0);
    expect(updateAutomation).toHaveBeenCalledWith({ id: 1, title: "Renamed" });
  });

  it("rejects invalid update payloads without calling the service", async () => {
    const cases = [
      { id: 0, title: "x" },
      { id: -5 },
      { id: 1, status: "paused" },
      { id: 1, model: { providerId: "a" } },
      { id: 1, trigger: { type: "event" } },
      { id: 1, trigger: { cronExpression: "" } },
      { id: 1, workspaceId: "a" },
    ];
    for (const request of cases) {
      const response = await updateController.run(event, request as never);
      expect(response.code).toBe(400);
    }
    expect(updateAutomation).not.toHaveBeenCalled();
  });

  it("deletes an automation", async () => {
    const response = await deleteController.run(event, { id: 1 });
    expect(response).toEqual({ code: 0, data: {}, msg: "ok" });
    expect(deleteAutomation).toHaveBeenCalledWith(1);
  });

  it("maps a running conflict to 409", async () => {
    deleteAutomation.mockImplementationOnce(() => {
      throw new AutomationRunningConflictError(1);
    });
    const response = await deleteController.run(event, { id: 1 });
    expect(response.code).toBe(409);
    expect(response.msg).toContain("running");
  });

  it("propagates missing-data errors", async () => {
    getAutomation.mockImplementationOnce(() => {
      throw new AutomationNotFoundError(999);
    });
    await expect(getController.run(event, { id: 999 })).rejects.toThrow(AutomationNotFoundError);
  });

  it("runs an automation now", async () => {
    const info: RunAutomationNowResponse = { ...run };
    runAutomationNow.mockResolvedValueOnce(info);
    const response = await runNowController.run(event, { id: 1 });
    expect(response.code).toBe(0);
    expect(response.data).toEqual(info);
  });

  it("maps a running conflict to 409 for run now", async () => {
    runAutomationNow.mockRejectedValueOnce(new AutomationRunningConflictError(1));
    const response = await runNowController.run(event, { id: 1 });
    expect(response.code).toBe(409);
    expect(response.msg).toContain("running");
  });

  it("lists automation runs with cursor and limit", async () => {
    const payload: ListAutomationRunsResponse = { runs: [run], nextCursor: 9 };
    listAutomationRuns.mockReturnValueOnce(payload);
    const response = await listRunsController.run(event, {
      automationId: 1,
      cursor: 12,
      limit: 20,
    });
    expect(response.code).toBe(0);
    expect(listAutomationRuns).toHaveBeenCalledWith(1, { cursor: 12, limit: 20 });
  });

  it("rejects invalid run history parameters without calling the service", async () => {
    const cases = [
      { automationId: 0 },
      { automationId: -1 },
      { automationId: 1, cursor: -2 },
      { automationId: 1, cursor: 1.5 },
      { automationId: 1, limit: 0 },
      { automationId: 1, limit: 101 },
      { automationId: 1, limit: 1.5 },
    ];
    for (const request of cases) {
      const response = await listRunsController.run(event, request as never);
      expect(response.code).toBe(400);
    }
    expect(listAutomationRuns).not.toHaveBeenCalled();
  });
});
