import type {
  ModelConfig,
  PermissionMode,
  SendMessageRequest,
  StopMessageRequest,
} from "@shared/api";
import { createGlobalState } from "@vueuse/core";
import { shallowRef } from "vue";
import { electronAPI } from "@/lib/ipc";

export interface QueuedMessagePayload {
  content: string;
  model: ModelConfig;
  approvalMode?: PermissionMode;
  reasoningEffort?: string;
}

export interface QueuedMessage {
  id: string;
  workspaceId: number;
  sessionId: string;
  payload: QueuedMessagePayload;
  createdAt: number;
}

interface MessageQueueTransport {
  send(request: SendMessageRequest): Promise<unknown>;
  stop(request: StopMessageRequest): Promise<{ stopped: boolean }>;
}

interface EnqueueMessageInput {
  workspaceId: number;
  sessionId: string;
  payload: QueuedMessagePayload;
  blocked?: boolean;
}

interface MessageQueueOptions {
  createId?: () => string;
  now?: () => number;
}

function sessionKey(workspaceId: number, sessionId: string): string {
  return `${workspaceId}:${sessionId}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function createMessageQueueState(
  transport: MessageQueueTransport,
  options: MessageQueueOptions = {},
) {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? Date.now;
  const queues = shallowRef<ReadonlyMap<string, readonly QueuedMessage[]>>(new Map());
  const activeSessionKeys = shallowRef<ReadonlySet<string>>(new Set());
  const stoppingSessionKeys = shallowRef<ReadonlySet<string>>(new Set());
  const errors = shallowRef<ReadonlyMap<string, string>>(new Map());

  function getQueuedMessages(workspaceId: number, sessionId: string): readonly QueuedMessage[] {
    return queues.value.get(sessionKey(workspaceId, sessionId)) ?? [];
  }

  function isSessionActive(workspaceId: number, sessionId: string): boolean {
    return activeSessionKeys.value.has(sessionKey(workspaceId, sessionId));
  }

  function isSessionStopping(workspaceId: number, sessionId: string): boolean {
    return stoppingSessionKeys.value.has(sessionKey(workspaceId, sessionId));
  }

  function getSessionError(workspaceId: number, sessionId: string): string {
    return errors.value.get(sessionKey(workspaceId, sessionId)) ?? "";
  }

  function setQueue(key: string, messages: readonly QueuedMessage[]): void {
    const next = new Map(queues.value);
    if (messages.length === 0) next.delete(key);
    else next.set(key, messages);
    queues.value = next;
  }

  function setMembership(state: typeof activeSessionKeys, key: string, present: boolean): void {
    const next = new Set(state.value);
    if (present) next.add(key);
    else next.delete(key);
    state.value = next;
  }

  function setError(key: string, error: string): void {
    const next = new Map(errors.value);
    if (error) next.set(key, error);
    else next.delete(key);
    errors.value = next;
  }

  function remove(workspaceId: number, sessionId: string, messageId: string): boolean {
    const key = sessionKey(workspaceId, sessionId);
    const current = queues.value.get(key) ?? [];
    const next = current.filter((message) => message.id !== messageId);
    if (next.length === current.length) return false;
    setQueue(key, next);
    return true;
  }

  async function drain(workspaceId: number, sessionId: string): Promise<void> {
    const key = sessionKey(workspaceId, sessionId);
    if (activeSessionKeys.value.has(key)) return;

    const nextMessage = queues.value.get(key)?.[0];
    if (!nextMessage) return;

    setMembership(activeSessionKeys, key, true);
    setQueue(key, (queues.value.get(key) ?? []).slice(1));

    try {
      await transport.send({
        workspaceId,
        sessionId,
        content: nextMessage.payload.content,
        model: nextMessage.payload.model,
        approvalMode: nextMessage.payload.approvalMode,
      });
    } catch (error) {
      setError(key, getErrorMessage(error, "发送消息失败，请重试。"));
      console.error("发送排队消息失败:", error);
    } finally {
      setMembership(activeSessionKeys, key, false);
      setMembership(stoppingSessionKeys, key, false);
      if ((queues.value.get(key)?.length ?? 0) > 0) void drain(workspaceId, sessionId);
    }
  }

  function enqueue(input: EnqueueMessageInput): QueuedMessage {
    const key = sessionKey(input.workspaceId, input.sessionId);
    const message: QueuedMessage = {
      id: createId(),
      workspaceId: input.workspaceId,
      sessionId: input.sessionId,
      payload: {
        ...input.payload,
        model: { ...input.payload.model },
      },
      createdAt: now(),
    };
    setQueue(key, [...(queues.value.get(key) ?? []), message]);
    setError(key, "");
    if (!input.blocked) void drain(input.workspaceId, input.sessionId);
    return message;
  }

  function resume(workspaceId: number, sessionId: string): void {
    setMembership(stoppingSessionKeys, sessionKey(workspaceId, sessionId), false);
    void drain(workspaceId, sessionId);
  }

  async function stop(workspaceId: number, sessionId: string): Promise<boolean> {
    const key = sessionKey(workspaceId, sessionId);
    if (stoppingSessionKeys.value.has(key)) return false;

    setMembership(stoppingSessionKeys, key, true);
    setError(key, "");
    try {
      const response = await transport.stop({ workspaceId, sessionId });
      if (!response.stopped) {
        setError(key, "当前任务已结束，无法暂停。");
        setMembership(stoppingSessionKeys, key, false);
      }
      return response.stopped;
    } catch (error) {
      setError(key, getErrorMessage(error, "暂停生成失败，请重试。"));
      setMembership(stoppingSessionKeys, key, false);
      console.error("暂停消息生成失败:", error);
      return false;
    }
  }

  return {
    enqueue,
    getQueuedMessages,
    getSessionError,
    isSessionActive,
    isSessionStopping,
    remove,
    resume,
    stop,
  };
}

const useGlobalMessageQueue = createGlobalState(() =>
  createMessageQueueState({
    send: (request) => electronAPI.sendMessage(request),
    stop: (request) => electronAPI.stopMessage(request),
  }),
);

export function useMessageQueue() {
  return useGlobalMessageQueue();
}
