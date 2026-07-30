// @vitest-environment jsdom

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type {
  MessageEventPayload,
  MessageStreamEvent,
  ToolApprovalEventPayload,
} from "@shared/api";
import { MESSAGE_EVENT } from "@shared/constants";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick, ref, type App, type Ref } from "vue";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  getMessageList: vi.fn(),
  removeEventListener: vi.fn(),
  waitUntilReady: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getMessageList: mocks.getMessageList,
  },
}));

vi.mock("@/composables/useEventBus", () => ({
  useEventBus: () => ({
    addEventListener: mocks.addEventListener,
    removeEventListener: mocks.removeEventListener,
    waitUntilReady: mocks.waitUntilReady,
  }),
}));

import {
  MESSAGE_CACHE_IDLE_TTL_MS,
  MESSAGE_CACHE_INACTIVE_LIMIT,
  useMessageListener,
  useMessageStatus,
  useSessionMessages,
} from "../src/renderer/src/composables/useMessage";
import {
  hydrateToolApproval,
  useToolApproval,
} from "../src/renderer/src/composables/useToolApproval";

type SessionMessages = ReturnType<typeof useSessionMessages>;
type ToolApproval = ReturnType<typeof useToolApproval>;

const mountedApps: App[] = [];
const touchedSessionIds = new Set<string>();
let sessionSequence = 0;

function nextSessionId(label: string): string {
  const sessionId = `${label}-${sessionSequence++}`;
  touchedSessionIds.add(sessionId);
  return sessionId;
}

function agentMessage(value: unknown): AgentMessage {
  return value as AgentMessage;
}

function streamEvent(value: unknown): MessageStreamEvent {
  return value as MessageStreamEvent;
}

function assistantMessage(text: string, timestamp: number): AgentMessage {
  return agentMessage({
    role: "assistant",
    content: [{ type: "text", text }],
    timestamp,
  });
}

function messageStart(sessionId: string, text: string, timestamp: number): MessageEventPayload {
  return {
    type: "stream",
    sessionId,
    event: streamEvent({
      type: "message_start",
      message: assistantMessage(text, timestamp),
    }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function getMessageListener(): (payload: MessageEventPayload) => void {
  const listener = mocks.addEventListener.mock.calls.find(
    ([event]) => event === MESSAGE_EVENT,
  )?.[1];
  if (!listener) throw new Error("message listener was not registered");
  return listener;
}

function mountListener(): App {
  const app = createApp({
    setup() {
      useMessageListener();
      return () => null;
    },
  });
  app.mount(document.createElement("div"));
  mountedApps.push(app);
  return app;
}

function mountSessionMessages(
  workspaceId: Ref<number | undefined>,
  sessionId: Ref<string | undefined>,
) {
  let messages: SessionMessages | undefined;
  let approval: ToolApproval | undefined;
  const app = createApp({
    setup() {
      useMessageListener();
      messages = useSessionMessages(workspaceId, sessionId);
      approval = useToolApproval(workspaceId, sessionId);
      return () => null;
    },
  });
  app.mount(document.createElement("div"));
  mountedApps.push(app);
  return {
    app,
    get messages() {
      if (!messages) throw new Error("session messages were not initialized");
      return messages;
    },
    get approval() {
      if (!approval) throw new Error("tool approval was not initialized");
      return approval;
    },
  };
}

function toolApproval(sessionId: string, approvalId: string): ToolApprovalEventPayload {
  return {
    approvalId,
    workspaceId: 1,
    sessionId,
    toolCallId: `call-${approvalId}`,
    toolName: "read",
    input: { path: "/outside/file.txt" },
    reason: "outside-workspace-read",
    display: "/outside/file.txt",
  };
}

async function flushMessages(): Promise<void> {
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMessageList.mockResolvedValue({ messages: [] });
  mocks.waitUntilReady.mockResolvedValue(undefined);
});

afterEach(() => {
  const listener = mocks.addEventListener.mock.calls[0]?.[1] as
    | ((payload: MessageEventPayload) => void)
    | undefined;
  for (const sessionId of touchedSessionIds) {
    listener?.({ type: "status", sessionId, status: "failed" });
  }
  touchedSessionIds.clear();

  for (const app of mountedApps.splice(0)) app.unmount();
  vi.useRealTimers();
});

describe("useMessage", () => {
  it("registers the global listener for the owner lifecycle", async () => {
    const app = mountListener();

    expect(mocks.addEventListener).toHaveBeenCalledWith(MESSAGE_EVENT, expect.any(Function));
    await vi.waitFor(() => expect(mocks.waitUntilReady).toHaveBeenCalledOnce());

    const listener = getMessageListener();
    app.unmount();
    mountedApps.splice(mountedApps.indexOf(app), 1);
    expect(mocks.removeEventListener).toHaveBeenCalledWith(MESSAGE_EVENT, listener);
  });

  it("keeps a running stream across route changes and isolates sessions", async () => {
    const workspaceId = ref<number | undefined>(1);
    const firstSessionId = nextSessionId("route-first");
    const secondSessionId = nextSessionId("route-second");
    const sessionId = ref<string | undefined>(firstSessionId);
    const mounted = mountSessionMessages(workspaceId, sessionId);
    await flushMessages();
    const listener = getMessageListener();

    listener({ type: "status", sessionId: firstSessionId, status: "started" });
    listener(messageStart(firstSessionId, "first stream", 1));
    listener({ type: "status", sessionId: secondSessionId, status: "started" });
    listener(messageStart(secondSessionId, "second stream", 2));
    await nextTick();

    sessionId.value = undefined;
    await nextTick();
    sessionId.value = secondSessionId;
    await flushMessages();
    expect(mounted.messages.timeline.value.messages).toHaveLength(1);
    expect(mounted.messages.timeline.value.messages[0]?.content).toEqual([
      { type: "text", text: "second stream", textSignature: undefined },
    ]);

    sessionId.value = firstSessionId;
    await nextTick();
    expect(mounted.messages.timeline.value.messages).toHaveLength(1);
    expect(mounted.messages.timeline.value.messages[0]?.content).toEqual([
      { type: "text", text: "first stream", textSignature: undefined },
    ]);
  });

  it("tracks whether sessions are executing across status and stream events", () => {
    mountListener();
    const listener = getMessageListener();
    const { isSessionRunning } = useMessageStatus();
    const sessionId = nextSessionId("status");

    listener({ type: "status", sessionId, status: "started" });
    expect(isSessionRunning(sessionId)).toBe(true);

    listener({ type: "status", sessionId, status: "completed" });
    expect(isSessionRunning(sessionId)).toBe(false);

    listener(messageStart(sessionId, "running again", 1));
    expect(isSessionRunning(sessionId)).toBe(true);

    listener({ type: "status", sessionId, status: "stopped" });
    expect(isSessionRunning(sessionId)).toBe(false);

    listener(messageStart(sessionId, "running once more", 2));
    listener({ type: "status", sessionId, status: "failed" });
    expect(isSessionRunning(sessionId)).toBe(false);
  });

  it("merges buffered stream events after history and falls back when history fails", async () => {
    const history = deferred<{ messages: AgentMessage[] }>();
    mocks.getMessageList.mockReturnValueOnce(history.promise);
    const workspaceId = ref<number | undefined>(1);
    const bufferedSessionId = nextSessionId("buffered");
    const sessionId = ref<string | undefined>(bufferedSessionId);
    const mounted = mountSessionMessages(workspaceId, sessionId);
    const listener = getMessageListener();

    listener(messageStart(bufferedSessionId, "streamed", 2));
    history.resolve({
      messages: [agentMessage({ role: "user", content: "history", timestamp: 1 })],
    });
    await vi.waitFor(() => expect(mounted.messages.loading.value).toBe(false));

    expect(mounted.messages.timeline.value.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);

    const failedSessionId = nextSessionId("history-failure");
    const error = new Error("history failed");
    mocks.getMessageList.mockRejectedValueOnce(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sessionId.value = failedSessionId;
    await nextTick();
    listener(messageStart(failedSessionId, "fallback stream", 3));
    await vi.waitFor(() => expect(mounted.messages.loading.value).toBe(false));

    expect(mounted.messages.timeline.value.messages[0]?.content).toEqual([
      { type: "text", text: "fallback stream", textSignature: undefined },
    ]);
    expect(consoleError).toHaveBeenCalledWith("读取消息记录失败:", error);
    consoleError.mockRestore();
  });

  it("ignores stale history responses after changing sessions", async () => {
    const staleHistory = deferred<{ messages: AgentMessage[] }>();
    mocks.getMessageList.mockReturnValueOnce(staleHistory.promise);
    const workspaceId = ref<number | undefined>(1);
    const staleSessionId = nextSessionId("stale");
    const currentSessionId = nextSessionId("current");
    const sessionId = ref<string | undefined>(staleSessionId);
    const mounted = mountSessionMessages(workspaceId, sessionId);

    sessionId.value = currentSessionId;
    await flushMessages();
    staleHistory.resolve({ messages: [assistantMessage("stale response", 1)] });
    await nextTick();

    expect(mounted.messages.timeline.value.messages).toEqual([]);
  });

  it("hydrates an unresolved approval while loading session history", async () => {
    const restoredSessionId = nextSessionId("approval-restored");
    const restoredApproval = toolApproval(restoredSessionId, "approval-restored");
    mocks.getMessageList.mockResolvedValueOnce({
      messages: [],
      pendingToolApproval: restoredApproval,
    });
    const workspaceId = ref<number | undefined>(1);
    const sessionId = ref<string | undefined>(restoredSessionId);
    const mounted = mountSessionMessages(workspaceId, sessionId);

    await vi.waitFor(() => expect(mounted.messages.loading.value).toBe(false));

    expect(mounted.approval.currentApproval.value).toEqual(restoredApproval);
  });

  it("keeps a newer live approval when an older history response is empty", async () => {
    const history = deferred<{ messages: AgentMessage[] }>();
    mocks.getMessageList.mockReturnValueOnce(history.promise);
    const currentSessionId = nextSessionId("approval-race");
    const liveApproval = toolApproval(currentSessionId, "approval-live");
    const workspaceId = ref<number | undefined>(1);
    const sessionId = ref<string | undefined>(currentSessionId);
    const mounted = mountSessionMessages(workspaceId, sessionId);

    hydrateToolApproval(1, currentSessionId, liveApproval);
    history.resolve({ messages: [] });
    await vi.waitFor(() => expect(mounted.messages.loading.value).toBe(false));

    expect(mounted.approval.currentApproval.value).toEqual(liveApproval);
  });

  it("protects consumed entries and releases terminal entries when the consumer leaves", async () => {
    const workspaceId = ref<number | undefined>(1);
    const terminalSessionId = nextSessionId("terminal");
    const sessionId = ref<string | undefined>(terminalSessionId);
    const mounted = mountSessionMessages(workspaceId, sessionId);
    await flushMessages();
    const listener = getMessageListener();

    listener(messageStart(terminalSessionId, "visible", 1));
    listener({ type: "status", sessionId: terminalSessionId, status: "completed" });
    await nextTick();
    expect(mounted.messages.timeline.value.messages).toHaveLength(1);

    sessionId.value = undefined;
    await nextTick();
    sessionId.value = terminalSessionId;
    await flushMessages();

    expect(mocks.getMessageList).toHaveBeenCalledTimes(2);
    expect(mounted.messages.timeline.value.messages).toEqual([]);
  });

  it("evicts idle and least-recently-used inactive streams", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-23T00:00:00.000Z"));
    const workspaceId = ref<number | undefined>(1);
    const sessionId = ref<string | undefined>();
    const mounted = mountSessionMessages(workspaceId, sessionId);
    const listener = getMessageListener();
    const { isSessionRunning } = useMessageStatus();

    const idleSessionId = nextSessionId("idle");
    listener(messageStart(idleSessionId, "idle stream", 1));
    vi.setSystemTime(Date.now() + MESSAGE_CACHE_IDLE_TTL_MS + 1);
    listener({ type: "status", sessionId: nextSessionId("prune-trigger"), status: "started" });
    expect(isSessionRunning(idleSessionId)).toBe(false);

    sessionId.value = idleSessionId;
    await flushMessages();
    expect(mounted.messages.timeline.value.messages).toEqual([]);

    sessionId.value = undefined;
    await nextTick();
    const lruSessionIds: string[] = [];
    for (let index = 0; index <= MESSAGE_CACHE_INACTIVE_LIMIT; index += 1) {
      vi.setSystemTime(Date.now() + 1);
      const currentSessionId = nextSessionId(`lru-${index}`);
      lruSessionIds.push(currentSessionId);
      listener(messageStart(currentSessionId, `stream ${index}`, index + 10));
    }

    sessionId.value = lruSessionIds[0];
    await flushMessages();
    expect(isSessionRunning(lruSessionIds[0]!)).toBe(false);
    expect(mounted.messages.timeline.value.messages).toEqual([]);

    sessionId.value = lruSessionIds.at(-1);
    await flushMessages();
    expect(isSessionRunning(lruSessionIds.at(-1)!)).toBe(true);
    expect(mounted.messages.timeline.value.messages[0]?.content).toEqual([
      {
        type: "text",
        text: `stream ${MESSAGE_CACHE_INACTIVE_LIMIT}`,
        textSignature: undefined,
      },
    ]);
  });
});
