import "reflect-metadata";
import type { AgentHarness, AgentHarnessEvent } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Model } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentService } from "../src/main/service/agent.service";
import type { WorkspaceDao } from "../src/main/service/dao/workspace.dao.server";
import type { EventService } from "../src/main/service/event.service";
import { MessageService } from "../src/main/service/message.service";
import type { SessionService } from "../src/main/service/session.service";
import type { UserConfigService } from "../src/main/service/user-config.service";
import { MESSAGE_EVENT } from "../src/shared/constants";

const model = { id: "model" } as Model<any>;
const modelConfig = { providerId: "openai", modelId: "large" };
const assistantMessage: AssistantMessage = {
  role: "assistant",
  content: [{ type: "text", text: "Done" }],
  api: "openai-completions",
  provider: "openai",
  model: "model",
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: "stop",
  timestamp: 1,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createHarness(prompt = vi.fn(async () => assistantMessage)) {
  let listener:
    | ((event: AgentHarnessEvent, signal?: AbortSignal) => Promise<void> | void)
    | undefined;
  const unsubscribe = vi.fn();
  const subscribe = vi.fn((next: typeof listener) => {
    listener = next;
    return unsubscribe;
  });
  const abort = vi.fn(async () => ({ clearedSteer: [], clearedFollowUp: [] }));
  const cleanup = vi.fn(async () => undefined);
  const harness = {
    prompt,
    subscribe,
    abort,
    env: { cleanup },
  } as unknown as AgentHarness;
  return {
    harness,
    prompt,
    subscribe,
    unsubscribe,
    abort,
    cleanup,
    emit: (event: AgentHarnessEvent) => listener?.(event),
  };
}

describe("MessageService", () => {
  const getSession = vi.fn<SessionService["getSession"]>();
  const getMessageList = vi.fn<SessionService["getMessageList"]>();
  const updateSessionTitle = vi.fn<SessionService["updateSessionTitle"]>();
  const getModel = vi.fn<AgentService["getModel"]>();
  const getAgentHarness = vi.fn<AgentService["getAgentHarness"]>();
  const getSimpleAgent = vi.fn<AgentService["getSimpleAgent"]>();
  const sendEvent = vi.fn<EventService["sendEvent"]>();
  const findById = vi.fn<WorkspaceDao["findById"]>();
  const getConfig = vi.fn<UserConfigService["getConfig"]>();

  const sessionService = {
    getSession,
    getMessageList,
    updateSessionTitle,
  } as unknown as SessionService;
  const agentService = {
    getModel,
    getAgentHarness,
    getSimpleAgent,
  } as unknown as AgentService;
  const eventService = { sendEvent } as unknown as EventService;
  const workspaceDao = { findById } as unknown as WorkspaceDao;
  const userConfigService = { getConfig } as unknown as UserConfigService;

  let service: MessageService;

  beforeEach(() => {
    service = new MessageService(
      sessionService,
      agentService,
      eventService,
      workspaceDao,
      userConfigService,
    );
    findById.mockReturnValue({ id: 1, name: "Willow", path: "/workspace/willow" } as never);
    getSession.mockReturnValue({
      id: "session",
      databaseId: 1,
      workspaceId: 1,
      title: "Existing title",
      createdAt: new Date(0).toISOString(),
    });
    getConfig.mockReturnValue({
      largeModel: { providerId: "openai", modelId: "large" },
      smallModel: { providerId: "openai", modelId: "small" },
    });
    getModel.mockReturnValue(model);
  });

  it("opens the persisted session and forwards only message stream events", async () => {
    const order: string[] = [];
    const harness = createHarness(
      vi.fn(async () => {
        order.push("prompt");
        return assistantMessage;
      }),
    );
    harness.subscribe.mockImplementation((_listener) => {
      order.push("subscribe");
      return (() => undefined) as ReturnType<AgentHarness["subscribe"]>;
    });
    getAgentHarness.mockResolvedValue(harness.harness);

    const result = await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: " Hello ",
      model: modelConfig,
    });

    expect(result).toBe(assistantMessage);
    expect(order).toEqual(["subscribe", "prompt"]);
    expect(getModel).toHaveBeenCalledWith("openai", "large");
    expect(getAgentHarness).toHaveBeenCalledWith({
      workspaceId: 1,
      cwd: "/workspace/willow",
      model,
      metadata: expect.objectContaining({ id: "session" }),
    });
    expect(harness.prompt).toHaveBeenCalledWith("Hello");
    expect(sendEvent).toHaveBeenNthCalledWith(1, MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "running",
    });
    expect(sendEvent).toHaveBeenLastCalledWith(MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "completed",
    });
  });

  it("forwards message events and filters harness-only events", async () => {
    const run = deferred<AssistantMessage>();
    const harness = createHarness(vi.fn(() => run.promise));
    getAgentHarness.mockResolvedValue(harness.harness);

    const sending = service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Hi",
      model: modelConfig,
    });
    await vi.waitFor(() => expect(harness.subscribe).toHaveBeenCalled());
    const messageEvent = {
      type: "message_end",
      message: assistantMessage,
    } satisfies AgentHarnessEvent;
    harness.emit(messageEvent);
    harness.emit({ type: "settled", nextTurnCount: 0 });
    run.resolve(assistantMessage);
    await sending;

    expect(sendEvent).toHaveBeenCalledWith(MESSAGE_EVENT, {
      type: "stream",
      sessionId: "session",
      event: messageEvent,
    });
    expect(sendEvent).not.toHaveBeenCalledWith(
      MESSAGE_EVENT,
      expect.objectContaining({ event: expect.objectContaining({ type: "settled" }) }),
    );
    expect(harness.unsubscribe).toHaveBeenCalledOnce();
  });

  it("rejects concurrent sends and aborts an active session", async () => {
    const run = deferred<AssistantMessage>();
    const harness = createHarness(vi.fn(() => run.promise));
    harness.abort.mockImplementation(async () => {
      run.resolve({ ...assistantMessage, stopReason: "aborted" });
      return { clearedSteer: [], clearedFollowUp: [] };
    });
    getAgentHarness.mockResolvedValue(harness.harness);

    const first = service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Hi",
      model: modelConfig,
    });
    await expect(
      service.sendMessage({
        workspaceId: 1,
        sessionId: "session",
        content: "Again",
        model: modelConfig,
      }),
    ).rejects.toThrow("Session is already running");
    await vi.waitFor(() => expect(harness.prompt).toHaveBeenCalled());
    await expect(service.stopMessage(1, "session")).resolves.toBe(true);
    await first;

    expect(harness.abort).toHaveBeenCalledOnce();
    expect(sendEvent).toHaveBeenCalledWith(MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "stopped",
    });
    expect(sendEvent).not.toHaveBeenCalledWith(
      MESSAGE_EVENT,
      expect.objectContaining({ status: "completed" }),
    );
    await expect(service.stopMessage(1, "session")).resolves.toBe(false);
  });

  it("allows different sessions to run concurrently", async () => {
    const firstRun = deferred<AssistantMessage>();
    const secondRun = deferred<AssistantMessage>();
    const firstHarness = createHarness(vi.fn(() => firstRun.promise));
    const secondHarness = createHarness(vi.fn(() => secondRun.promise));
    getAgentHarness
      .mockResolvedValueOnce(firstHarness.harness)
      .mockResolvedValueOnce(secondHarness.harness);

    const first = service.sendMessage({
      workspaceId: 1,
      sessionId: "first",
      content: "One",
      model: modelConfig,
    });
    const second = service.sendMessage({
      workspaceId: 1,
      sessionId: "second",
      content: "Two",
      model: modelConfig,
    });
    await vi.waitFor(() => {
      expect(firstHarness.prompt).toHaveBeenCalledOnce();
      expect(secondHarness.prompt).toHaveBeenCalledOnce();
    });

    firstRun.resolve(assistantMessage);
    secondRun.resolve(assistantMessage);
    await expect(Promise.all([first, second])).resolves.toEqual([
      assistantMessage,
      assistantMessage,
    ]);
  });

  it("cleans up and emits a safe failure status when prompt rejects", async () => {
    const error = new Error("provider secret details");
    const harness = createHarness(vi.fn(async () => Promise.reject(error)));
    getAgentHarness.mockResolvedValue(harness.harness);

    await expect(
      service.sendMessage({
        workspaceId: 1,
        sessionId: "session",
        content: "Hi",
        model: modelConfig,
      }),
    ).rejects.toBe(error);

    expect(harness.unsubscribe).toHaveBeenCalledOnce();
    expect(sendEvent).toHaveBeenLastCalledWith(MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "failed",
      error: "Message generation failed",
    });
  });

  it("delegates active-branch history reads", async () => {
    const messages = [{ role: "user", content: "Hi", timestamp: 1 }] as const;
    getMessageList.mockResolvedValue(messages as never);

    await expect(service.getMessageList(1, "session")).resolves.toBe(messages);
    expect(getMessageList).toHaveBeenCalledWith(1, "session");
  });

  it("generates, normalizes, and persists a title with the small model", async () => {
    getSession.mockReturnValue({
      id: "session",
      databaseId: 1,
      workspaceId: 1,
      title: "",
      createdAt: new Date(0).toISOString(),
    });
    const titleHarness = createHarness(
      vi.fn(async () => ({
        ...assistantMessage,
        content: [{ type: "text", text: `**“${"长".repeat(60)}”**` }],
      })),
    );
    getSimpleAgent.mockResolvedValue(titleHarness.harness);
    updateSessionTitle.mockResolvedValue({} as never);

    const title = await service.createTitle({
      workspaceId: 1,
      sessionId: "session",
      content: "A user request",
    });

    expect([...title]).toHaveLength(50);
    expect(title).toBe("长".repeat(50));
    expect(getSimpleAgent).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: "/workspace/willow", model }),
    );
    expect(updateSessionTitle).toHaveBeenCalledWith(1, "session", title);
    expect(titleHarness.cleanup).toHaveBeenCalledOnce();
    expect(sendEvent).toHaveBeenCalledWith(MESSAGE_EVENT, {
      type: "title_updated",
      sessionId: "session",
      title,
    });
  });

  it("falls back to the first message when the small model is unavailable", async () => {
    getSession.mockReturnValue({
      id: "session",
      databaseId: 1,
      workspaceId: 1,
      title: "",
      createdAt: new Date(0).toISOString(),
    });
    getConfig.mockReturnValue({ largeModel: { providerId: "openai", modelId: "large" } });
    updateSessionTitle.mockResolvedValue({} as never);

    await expect(
      service.createTitle({
        workspaceId: 1,
        sessionId: "session",
        content: "  First\n  user   message  ",
      }),
    ).resolves.toBe("First user message");
    expect(getSimpleAgent).not.toHaveBeenCalled();
    expect(updateSessionTitle).toHaveBeenCalledWith(1, "session", "First user message");
  });

  it("falls back when title generation fails and cleans up the lightweight agent", async () => {
    getSession.mockReturnValue({
      id: "session",
      databaseId: 1,
      workspaceId: 1,
      title: "",
      createdAt: new Date(0).toISOString(),
    });
    const titleHarness = createHarness(vi.fn(async () => Promise.reject(new Error("failed"))));
    getSimpleAgent.mockResolvedValue(titleHarness.harness);
    updateSessionTitle.mockResolvedValue({} as never);

    await expect(
      service.createTitle({ workspaceId: 1, sessionId: "session", content: "Fallback title" }),
    ).resolves.toBe("Fallback title");
    expect(titleHarness.cleanup).toHaveBeenCalledOnce();
    expect(updateSessionTitle).toHaveBeenCalledWith(1, "session", "Fallback title");
  });

  it("does not block sends on title generation and deduplicates pending title work", async () => {
    getSession.mockReturnValue({
      id: "session",
      databaseId: 1,
      workspaceId: 1,
      title: "",
      createdAt: new Date(0).toISOString(),
    });
    const mainHarness = createHarness();
    const titleRun = deferred<AssistantMessage>();
    const titleHarness = createHarness(vi.fn(() => titleRun.promise));
    getAgentHarness.mockResolvedValue(mainHarness.harness);
    getSimpleAgent.mockResolvedValue(titleHarness.harness);
    updateSessionTitle.mockResolvedValue({} as never);

    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "First",
      model: modelConfig,
    });
    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Second",
      model: modelConfig,
    });

    expect(getSimpleAgent).toHaveBeenCalledOnce();
    expect(updateSessionTitle).not.toHaveBeenCalled();

    titleRun.resolve({ ...assistantMessage, content: [{ type: "text", text: "Generated" }] });
    await vi.waitFor(() =>
      expect(updateSessionTitle).toHaveBeenCalledWith(1, "session", "Generated"),
    );
  });

  it("validates prerequisites before creating a harness", async () => {
    await expect(
      service.sendMessage({
        workspaceId: 1,
        sessionId: "session",
        content: "  ",
        model: modelConfig,
      }),
    ).rejects.toThrow("non-empty string");
    expect(getAgentHarness).not.toHaveBeenCalled();

    findById.mockReturnValueOnce(undefined);
    await expect(
      service.sendMessage({
        workspaceId: 99,
        sessionId: "session",
        content: "Hi",
        model: modelConfig,
      }),
    ).rejects.toThrow("Workspace not found");

    getModel.mockImplementationOnce(() => {
      throw new Error("Unsupported model");
    });
    await expect(
      service.sendMessage({
        workspaceId: 1,
        sessionId: "session",
        content: "Hi",
        model: { providerId: "openai", modelId: "missing" },
      }),
    ).rejects.toThrow("Unsupported model");
    expect(getAgentHarness).not.toHaveBeenCalled();
  });
});
