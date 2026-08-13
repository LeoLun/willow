import "reflect-metadata";
import type { AgentHarnessOptions } from "@willow/core";
import { describe, expect, it, vi } from "vitest";
import {
  AgentService,
  type WorkspaceCreateAutomationHandler,
  type WorkspaceDeleteAutomationHandler,
  type WorkspaceListAutomationsHandler,
  type WorkspaceUpdateAutomationHandler,
} from "../src/main/service/agent.service";

const mock = vi.hoisted(() => {
  const state: { harnessOptions?: AgentHarnessOptions } = {};
  class MockAgentCore {
    constructor(_options: unknown) {}
    async getAgentHarness(options: AgentHarnessOptions) {
      state.harnessOptions = options;
      return { subscribe: () => () => undefined };
    }
  }
  return { state, MockAgentCore };
});

vi.mock("@willow/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@willow/core")>();
  return { ...original, AgentCore: mock.MockAgentCore };
});

function createService(): AgentService {
  return new AgentService(
    {
      getCredentialStore: () => ({}),
      getCredential: async () => undefined,
    } as never,
    { create: () => ({}) } as never,
    { startRun: vi.fn(), recordUsage: vi.fn() } as never,
    { getCoreOptions: () => ({ directory: "/tmp/willow-skills" }) } as never,
  );
}

describe("AgentService createAutomation handler wiring", () => {
  it("passes a workspace-bound handler to the agent harness when configured", async () => {
    const handler: WorkspaceCreateAutomationHandler = vi.fn(async () => ({
      ok: true,
      automationId: 1,
      title: "t",
      cronExpression: "0 9 * * *",
    }));
    const service = createService();
    service.setCreateAutomationHandler(handler);

    await service.getAgentHarness({
      workspaceId: 7,
      model: { id: "m" } as never,
      metadata: { id: "session-1" } as never,
      permissionMode: "request-approval",
      requestApproval: vi.fn(),
      requestUser: vi.fn(),
    });

    const createAutomation = mock.state.harnessOptions?.createAutomation;
    expect(createAutomation).toBeTypeOf("function");

    const result = await createAutomation!({
      prompt: "x",
      cronExpression: "0 9 * * *",
    });
    expect(handler).toHaveBeenCalledWith(7, { prompt: "x", cronExpression: "0 9 * * *" });
    expect(result).toMatchObject({ ok: true, automationId: 1 });
  });

  it("leaves the harness option undefined when no handler is configured", async () => {
    const service = createService();

    await service.getAgentHarness({
      workspaceId: 1,
      model: { id: "m" } as never,
      metadata: { id: "session-1" } as never,
      permissionMode: "request-approval",
      requestApproval: vi.fn(),
      requestUser: vi.fn(),
    });

    expect(mock.state.harnessOptions?.createAutomation).toBeUndefined();
  });
});

describe("AgentService automation management handler wiring", () => {
  it("passes workspace-bound list, update, and delete handlers to the harness", async () => {
    const listHandler: WorkspaceListAutomationsHandler = vi.fn(async () => ({
      ok: true,
      automations: [],
    }));
    const updateHandler: WorkspaceUpdateAutomationHandler = vi.fn(async () => ({
      ok: true,
      automationId: 2,
      title: "日报",
      status: "enabled",
      cronExpression: "0 10 * * *",
      timezone: "Asia/Shanghai",
    }));
    const deleteHandler: WorkspaceDeleteAutomationHandler = vi.fn(async () => ({
      ok: true,
      automationId: 2,
      title: "日报",
    }));
    const service = createService();
    service.setListAutomationsHandler(listHandler);
    service.setUpdateAutomationHandler(updateHandler);
    service.setDeleteAutomationHandler(deleteHandler);

    await service.getAgentHarness({
      workspaceId: 7,
      model: { id: "m" } as never,
      metadata: { id: "session-1" } as never,
      permissionMode: "request-approval",
      requestApproval: vi.fn(),
      requestUser: vi.fn(),
    });

    await mock.state.harnessOptions?.listAutomations?.({});
    await mock.state.harnessOptions?.updateAutomation?.({
      automationId: 2,
      cronExpression: "0 10 * * *",
    });
    await mock.state.harnessOptions?.deleteAutomation?.({ automationId: 2 });

    expect(listHandler).toHaveBeenCalledWith(7, {});
    expect(updateHandler).toHaveBeenCalledWith(7, {
      automationId: 2,
      cronExpression: "0 10 * * *",
    });
    expect(deleteHandler).toHaveBeenCalledWith(7, { automationId: 2 });
  });

  it("leaves management handlers undefined when not configured", async () => {
    const service = createService();
    await service.getAgentHarness({
      workspaceId: 1,
      model: { id: "m" } as never,
      metadata: { id: "session-1" } as never,
      permissionMode: "request-approval",
      requestApproval: vi.fn(),
      requestUser: vi.fn(),
    });

    expect(mock.state.harnessOptions?.listAutomations).toBeUndefined();
    expect(mock.state.harnessOptions?.updateAutomation).toBeUndefined();
    expect(mock.state.harnessOptions?.deleteAutomation).toBeUndefined();
  });
});
