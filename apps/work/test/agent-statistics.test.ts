import "reflect-metadata";
import type { AgentHarnessEvent } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const harnesses: Array<{
    subscribe: ReturnType<typeof vi.fn>;
    emit: (event: unknown) => void;
  }> = [];
  const fullHarness = {
    listener: undefined as ((event: unknown) => void) | undefined,
    subscribe: vi.fn((listener: (event: unknown) => void) => {
      fullHarness.listener = listener;
      return vi.fn();
    }),
    emit(event: unknown) {
      fullHarness.listener?.(event);
    },
  };
  return {
    harnesses,
    fullHarness,
    getProvider: vi.fn(() => ({ name: "OpenAI" })),
    getModel: vi.fn(() => ({ name: "GPT" })),
  };
});

vi.mock("@earendil-works/pi-agent-core", () => {
  class AgentHarness {
    listener?: (event: unknown) => void;
    subscribe = vi.fn((listener: (event: unknown) => void) => {
      this.listener = listener;
      return vi.fn();
    });
    emit(event: unknown) {
      this.listener?.(event);
    }
    constructor() {
      mocks.harnesses.push(this);
    }
  }
  class InMemorySessionRepo {
    async create() {
      return {};
    }
  }
  return { AgentHarness, InMemorySessionRepo };
});

vi.mock("@earendil-works/pi-agent-core/node", () => ({
  NodeExecutionEnv: class NodeExecutionEnv {},
}));

vi.mock("@earendil-works/pi-ai/providers/all", () => ({
  builtinModels: () => ({
    getProvider: mocks.getProvider,
    getModel: mocks.getModel,
  }),
}));

vi.mock("@willow/core", () => ({
  AgentCore: class AgentCore {
    async getAgentHarness() {
      return mocks.fullHarness;
    }
  },
}));

import { AgentService } from "../src/main/service/agent.service";
import type { CredentialService } from "../src/main/service/credential.service";
import type { SessionManagerFactory } from "../src/main/service/session-manager.factory";
import type { StatisticsService } from "../src/main/service/statistics.service";

const assistantMessage = {
  role: "assistant",
  content: [],
  api: "openai-completions",
  provider: "openai",
  model: "gpt",
  usage: {
    input: 1,
    output: 2,
    cacheRead: 3,
    cacheWrite: 4,
    totalTokens: 10,
    cost: { input: 0.1, output: 0.2, cacheRead: 0.03, cacheWrite: 0.04, total: 0.37 },
  },
  stopReason: "stop",
  timestamp: 1,
} as AssistantMessage;

describe("AgentService statistics interception", () => {
  const startRun = vi.fn<StatisticsService["startRun"]>();
  const recordUsage = vi.fn<StatisticsService["recordUsage"]>();
  const statisticsService = { startRun, recordUsage } as unknown as StatisticsService;
  const credentialService = {
    getCredentialStore: vi.fn(() => ({})),
  } as unknown as CredentialService;
  const sessionManagerFactory = {
    create: vi.fn(() => ({})),
  } as unknown as SessionManagerFactory;
  let service: AgentService;

  beforeEach(() => {
    mocks.harnesses.length = 0;
    mocks.fullHarness.listener = undefined;
    startRun.mockReturnValue(11);
    service = new AgentService(credentialService, sessionManagerFactory, statisticsService);
  });

  it("marks full agents as chat tasks and records every assistant response", async () => {
    const harness = await service.getAgentHarness({
      workspaceId: 2,
      cwd: "/workspace",
      model: { id: "gpt" } as never,
      metadata: { id: "session-2" },
      permissionMode: "request-approval",
      requestApproval: vi.fn(async () => "allow"),
    });

    mocks.fullHarness.emit({ type: "agent_start" } satisfies AgentHarnessEvent);
    mocks.fullHarness.emit({
      type: "message_end",
      message: assistantMessage,
    } satisfies AgentHarnessEvent);
    mocks.fullHarness.emit({
      type: "message_end",
      message: { ...assistantMessage, timestamp: 2 },
    } satisfies AgentHarnessEvent);

    expect(harness).toBe(mocks.fullHarness);
    expect(startRun).toHaveBeenCalledWith({
      source: "chat",
      workspaceId: 2,
      sessionId: "session-2",
    });
    expect(recordUsage).toHaveBeenCalledTimes(2);
    expect(recordUsage).toHaveBeenCalledWith({
      runId: 11,
      message: assistantMessage,
      providerName: "OpenAI",
      modelName: "GPT",
    });
  });

  it("marks lightweight title agents separately", async () => {
    const harness = await service.getSimpleAgent({
      cwd: "/workspace",
      model: { id: "gpt" } as never,
      systemPrompt: "title",
      workspaceId: 3,
      sessionId: "session-3",
      source: "title",
    });
    const created = mocks.harnesses[0];
    created.emit({ type: "agent_start" });
    created.emit({ type: "message_end", message: assistantMessage });

    expect(harness).toBe(created);
    expect(startRun).toHaveBeenCalledWith({
      source: "title",
      workspaceId: 3,
      sessionId: "session-3",
    });
    expect(recordUsage).toHaveBeenCalledOnce();
  });

  it("isolates statistics failures from agent events", async () => {
    const error = new Error("write failed");
    startRun.mockImplementationOnce(() => {
      throw error;
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await service.getSimpleAgent({
      cwd: "/workspace",
      model: { id: "gpt" } as never,
      systemPrompt: "title",
      workspaceId: 1,
      sessionId: "session",
      source: "title",
    });

    expect(() => mocks.harnesses[0].emit({ type: "agent_start" })).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith("Failed to record agent statistics:", error);
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("records AI approval agents separately from chat tasks", async () => {
    await service.getSimpleAgent({
      cwd: "/workspace",
      model: { id: "gpt" } as never,
      systemPrompt: "approval",
      workspaceId: 4,
      sessionId: "session-4",
      source: "approval",
    });
    mocks.harnesses[0].emit({ type: "agent_start" });

    expect(startRun).toHaveBeenCalledWith({
      source: "approval",
      workspaceId: 4,
      sessionId: "session-4",
    });
  });
});
