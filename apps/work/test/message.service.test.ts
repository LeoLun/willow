import "reflect-metadata";
import { AgentHarness, type AgentHarnessEvent } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Model } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentService } from "../src/main/service/agent.service";
import type { AiToolApprovalService } from "../src/main/service/ai-tool-approval.service";
import type { WorkspaceDao } from "../src/main/service/dao/workspace.dao.server";
import type { EventService } from "../src/main/service/event.service";
import { MessageService } from "../src/main/service/message.service";
import type { SessionService } from "../src/main/service/session.service";
import type { TitleService } from "../src/main/service/title.service";
import type { ToolApprovalService } from "../src/main/service/tool-approval.service";
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
  const getModel = vi.fn<AgentService["getModel"]>();
  const getAgentHarness = vi.fn<AgentService["getAgentHarness"]>();
  const sendEvent = vi.fn<EventService["sendEvent"]>();
  const findById = vi.fn<WorkspaceDao["findById"]>();
  const startTitleCreation = vi.fn<TitleService["startTitleCreation"]>();
  const review = vi.fn<AiToolApprovalService["review"]>();
  const requestApproval = vi.fn<ToolApprovalService["request"]>();
  const getPendingApproval = vi.fn<ToolApprovalService["getPendingApproval"]>();
  const resolveApproval = vi.fn<ToolApprovalService["resolve"]>();

  const sessionService = {
    getSession,
    getMessageList,
  } as unknown as SessionService;
  const agentService = {
    getModel,
    getAgentHarness,
  } as unknown as AgentService;
  const eventService = { sendEvent } as unknown as EventService;
  const workspaceDao = { findById } as unknown as WorkspaceDao;
  const titleService = { startTitleCreation } as unknown as TitleService;
  const aiToolApprovalService = { review } as unknown as AiToolApprovalService;
  const toolApprovalService = {
    getPendingApproval,
    request: requestApproval,
    resolve: resolveApproval,
  } as unknown as ToolApprovalService;

  let service: MessageService;

  it("loads an AgentHarness with the persisted-session continuation API", () => {
    expect(AgentHarness.prototype.continue).toBeTypeOf("function");
  });

  beforeEach(() => {
    service = new MessageService(
      sessionService,
      agentService,
      eventService,
      workspaceDao,
      titleService,
      aiToolApprovalService,
      toolApprovalService,
    );
    findById.mockReturnValue({
      id: 1,
      name: "Willow",
      path: "/workspace/willow",
    } as never);
    getSession.mockReturnValue({
      id: "session",
      databaseId: 1,
      workspaceId: 1,
      title: "Existing title",
      createdAt: new Date(0).toISOString(),
    });
    getModel.mockReturnValue(model);
    getPendingApproval.mockResolvedValue(undefined);
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
      permissionMode: "request-approval",
      requestApproval: expect.any(Function),
    });
    expect(harness.prompt).toHaveBeenCalledWith("Hello");
    expect(sendEvent).toHaveBeenNthCalledWith(1, MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "started",
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
      expect.objectContaining({
        event: expect.objectContaining({ type: "settled" }),
      }),
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

    await expect(service.getMessageList(1, "session")).resolves.toEqual({
      messages,
      pendingToolApproval: undefined,
    });
    expect(getMessageList).toHaveBeenCalledWith(1, "session");
    expect(getPendingApproval).toHaveBeenCalledWith(1, "session");
  });

  it("starts title creation for an untitled session", async () => {
    getSession.mockReturnValue({
      id: "session",
      databaseId: 1,
      workspaceId: 1,
      title: "",
      createdAt: new Date(0).toISOString(),
    });
    const mainHarness = createHarness();
    getAgentHarness.mockResolvedValue(mainHarness.harness);

    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "First",
      model: modelConfig,
    });

    expect(startTitleCreation).toHaveBeenCalledWith({
      workspaceId: 1,
      sessionId: "session",
      content: "First",
    });
  });

  it("uses AI approval for delegated escapes and skips the user dialog when approved", async () => {
    const harness = createHarness();
    getAgentHarness.mockResolvedValue(harness.harness);
    review.mockResolvedValue({ status: "approved", reason: "Matches the current task." });

    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Install the requested package",
      model: modelConfig,
      approvalMode: "delegate-approval",
    });
    const handler = getAgentHarness.mock.calls.at(-1)?.[0].requestApproval;
    const decision = await handler?.({
      toolCallId: "call",
      toolName: "bash",
      input: { command: "pnpm install" },
      reason: "sandbox-denied",
      display: "pnpm install",
    });

    expect(decision).toBe("allow");
    expect(review).toHaveBeenCalledWith(
      expect.objectContaining({
        workspacePath: "/workspace/willow",
        userMessage: "Install the requested package",
      }),
      undefined,
    );
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it("falls back to one-time user approval when AI rejects or fails", async () => {
    const harness = createHarness();
    getAgentHarness.mockResolvedValue(harness.harness);
    review.mockResolvedValue({ status: "rejected", reason: "The command is too broad." });
    requestApproval.mockResolvedValue("allow");

    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Clean generated files",
      model: modelConfig,
      approvalMode: "delegate-approval",
    });
    const handler = getAgentHarness.mock.calls.at(-1)?.[0].requestApproval;
    const toolRequest = {
      toolCallId: "call",
      toolName: "bash" as const,
      input: { command: "rm -rf /tmp/output" },
      reason: "sandbox-denied" as const,
      display: "rm -rf /tmp/output",
    };

    await expect(handler?.(toolRequest)).resolves.toBe("allow");
    expect(requestApproval).toHaveBeenCalledWith(
      1,
      "session",
      toolRequest,
      {
        model: modelConfig,
        permissionMode: "delegate-approval",
        userMessage: "Clean generated files",
      },
      undefined,
      {
        status: "rejected",
        reason: "The command is too broad.",
      },
    );
  });

  it("rebuilds and continues a session after resolving a persisted approval", async () => {
    const execute = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "outside contents" }],
      details: { path: "/outside/file.txt" },
    }));
    const appendMessage = vi.fn(async () => undefined);
    const continuation = deferred<AssistantMessage>();
    const continueRun = vi.fn(() => continuation.promise);
    const recoveredHarness = createHarness();
    Object.assign(recoveredHarness.harness as object, {
      appendMessage,
      continue: continueRun,
      getTools: () => [{ name: "read", execute }],
    });
    getAgentHarness.mockResolvedValue(recoveredHarness.harness);
    const approval = {
      model: modelConfig,
      permissionMode: "request-approval" as const,
      userMessage: "Read the outside file",
      payload: {
        approvalId: "approval-recovered",
        workspaceId: 1,
        sessionId: "session",
        toolCallId: "call-recovered",
        toolName: "read" as const,
        input: { path: "/outside/file.txt" },
        reason: "outside-workspace-read" as const,
        display: "/outside/file.txt",
      },
    };
    resolveApproval.mockResolvedValue({ approval, live: false });
    await expect(
      service.resolveToolApproval({
        approvalId: approval.payload.approvalId,
        workspaceId: approval.payload.workspaceId,
        sessionId: approval.payload.sessionId,
        decision: "allow",
      }),
    ).resolves.toBe(true);

    expect(resolveApproval).toHaveBeenCalledWith(
      1,
      "session",
      "approval-recovered",
      "allow",
      "recovered",
    );
    await vi.waitFor(() => expect(continueRun).toHaveBeenCalledOnce());
    expect(execute).toHaveBeenCalledWith("call-recovered", {
      path: "/outside/file.txt",
    });
    expect(appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "toolResult",
        toolCallId: "call-recovered",
        toolName: "read",
        isError: false,
      }),
    );
    expect(sendEvent).not.toHaveBeenCalledWith(MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "completed",
    });

    continuation.resolve(assistantMessage);
    await vi.waitFor(() =>
      expect(sendEvent).toHaveBeenCalledWith(MESSAGE_EVENT, {
        type: "status",
        sessionId: "session",
        status: "completed",
      }),
    );
  });

  it("returns a recovered approval response before the continued agent finishes", async () => {
    const continuation = deferred<AssistantMessage>();
    const continueRun = vi.fn(() => continuation.promise);
    const recoveredHarness = createHarness();
    Object.assign(recoveredHarness.harness as object, {
      appendMessage: vi.fn(async () => undefined),
      continue: continueRun,
      getTools: () => [],
    });
    getAgentHarness.mockResolvedValue(recoveredHarness.harness);
    const approval = {
      model: modelConfig,
      permissionMode: "request-approval" as const,
      userMessage: "Read the outside file",
      payload: {
        approvalId: "approval-immediate",
        workspaceId: 1,
        sessionId: "session",
        toolCallId: "call-immediate",
        toolName: "read" as const,
        input: { path: "/outside/file.txt" },
        reason: "outside-workspace-read" as const,
        display: "/outside/file.txt",
      },
    };
    resolveApproval.mockResolvedValue({ approval, live: false });
    const resolved = service.resolveToolApproval({
      approvalId: approval.payload.approvalId,
      workspaceId: approval.payload.workspaceId,
      sessionId: approval.payload.sessionId,
      decision: "deny",
    });

    await expect(resolved).resolves.toBe(true);
    expect(resolveApproval).toHaveBeenCalledWith(
      1,
      "session",
      "approval-immediate",
      "deny",
      "recovered",
    );
    expect(sendEvent).not.toHaveBeenCalledWith(MESSAGE_EVENT, {
      type: "status",
      sessionId: "session",
      status: "completed",
    });

    await vi.waitFor(() => expect(continueRun).toHaveBeenCalledOnce());
    continuation.resolve(assistantMessage);
    await vi.waitFor(() =>
      expect(sendEvent).toHaveBeenCalledWith(MESSAGE_EVENT, {
        type: "status",
        sessionId: "session",
        status: "completed",
      }),
    );
  });

  it("continues a recovered session without executing the tool after denial", async () => {
    const appendMessage = vi.fn(async () => undefined);
    const continueRun = vi.fn(async () => assistantMessage);
    const getTools = vi.fn(() => []);
    const recoveredHarness = createHarness();
    Object.assign(recoveredHarness.harness as object, {
      appendMessage,
      continue: continueRun,
      getTools,
    });
    getAgentHarness.mockResolvedValue(recoveredHarness.harness);
    const approval = {
      model: modelConfig,
      permissionMode: "request-approval" as const,
      userMessage: "Read the outside file",
      payload: {
        approvalId: "approval-denied",
        workspaceId: 1,
        sessionId: "session",
        toolCallId: "call-denied",
        toolName: "read" as const,
        input: { path: "/outside/file.txt" },
        reason: "outside-workspace-read" as const,
        display: "/outside/file.txt",
      },
    };
    resolveApproval.mockResolvedValue({ approval, live: false });
    await expect(
      service.resolveToolApproval({
        approvalId: approval.payload.approvalId,
        workspaceId: approval.payload.workspaceId,
        sessionId: approval.payload.sessionId,
        decision: "deny",
      }),
    ).resolves.toBe(true);

    await vi.waitFor(() => expect(continueRun).toHaveBeenCalledOnce());
    expect(getTools).not.toHaveBeenCalled();
    expect(appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "toolResult",
        toolCallId: "call-denied",
        isError: true,
        content: [{ type: "text", text: "用户拒绝了此工具调用。" }],
      }),
    );
    expect(resolveApproval).toHaveBeenCalledWith(
      1,
      "session",
      "approval-denied",
      "deny",
      "recovered",
    );
  });

  it("bypasses AI in request-approval mode and denies aborted delegated reviews", async () => {
    const harness = createHarness();
    getAgentHarness.mockResolvedValue(harness.harness);
    requestApproval.mockResolvedValue("deny");

    await service.sendMessage({
      workspaceId: 1,
      sessionId: "session",
      content: "Run command",
      model: modelConfig,
      approvalMode: "request-approval",
    });
    const requestHandler = getAgentHarness.mock.calls.at(-1)?.[0].requestApproval;
    const toolRequest = {
      toolCallId: "call",
      toolName: "bash" as const,
      input: { command: "curl example.com" },
      reason: "sandbox-denied" as const,
      display: "curl example.com",
    };
    await expect(requestHandler?.(toolRequest)).resolves.toBe("deny");
    expect(review).not.toHaveBeenCalled();

    const controller = new AbortController();
    controller.abort();
    await expect(requestHandler?.(toolRequest, controller.signal)).resolves.toBe("deny");
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
