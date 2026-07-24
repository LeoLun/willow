import type { MessageEventPayload, MessageStreamEvent, SessionStatus } from "@shared/api";
import { MESSAGE_EVENT } from "@shared/constants";
import { createGlobalState } from "@vueuse/core";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef,
} from "vue";
import {
  applyMessageStreamEvent,
  createMessageTimeline,
  type MessageTimeline,
} from "@/components/message-list";
import { electronAPI } from "@/lib/ipc";
import { useEventBus } from "./useEventBus";

export const MESSAGE_CACHE_IDLE_TTL_MS = 30 * 60 * 1000;
export const MESSAGE_CACHE_INACTIVE_LIMIT = 20;

type MessageCacheEntry = {
  timeline: ShallowRef<MessageTimeline>;
  loading: Ref<boolean>;
  bufferedEvents: MessageStreamEvent[];
  historyReady: boolean;
  status?: SessionStatus;
  consumers: number;
  lastTouched: number;
  loadGeneration: number;
};

const emptyTimeline = createMessageTimeline();
const terminalStatuses = new Set<SessionStatus>(["completed", "stopped", "failed"]);

function isTerminalStatus(status?: SessionStatus): boolean {
  return status !== undefined && terminalStatuses.has(status);
}

const useMessageState = createGlobalState(() => {
  const entries = new Map<string, MessageCacheEntry>();
  const runningSessionIds = shallowRef<ReadonlySet<string>>(new Set());

  function setSessionRunning(sessionId: string, running: boolean): void {
    const isRunning = runningSessionIds.value.has(sessionId);
    if (isRunning === running) return;

    const nextRunningSessionIds = new Set(runningSessionIds.value);
    if (running) {
      nextRunningSessionIds.add(sessionId);
    } else {
      nextRunningSessionIds.delete(sessionId);
    }
    runningSessionIds.value = nextRunningSessionIds;
  }

  function createEntry(): MessageCacheEntry {
    return {
      timeline: shallowRef(createMessageTimeline()),
      loading: ref(false),
      bufferedEvents: [],
      historyReady: false,
      consumers: 0,
      lastTouched: Date.now(),
      loadGeneration: 0,
    };
  }

  function getOrCreateEntry(sessionId: string): MessageCacheEntry {
    let entry = entries.get(sessionId);
    if (!entry) {
      entry = createEntry();
      entries.set(sessionId, entry);
    }
    return entry;
  }

  function deleteEntry(sessionId: string, entry: MessageCacheEntry): void {
    if (entries.get(sessionId) !== entry) return;
    entry.loadGeneration += 1;
    entries.delete(sessionId);
    setSessionRunning(sessionId, false);
  }

  function pruneEntries(now = Date.now()): void {
    const inactiveEntries = [...entries.entries()].filter(([, entry]) => entry.consumers === 0);

    for (const [sessionId, entry] of inactiveEntries) {
      if (isTerminalStatus(entry.status) || now - entry.lastTouched >= MESSAGE_CACHE_IDLE_TTL_MS) {
        deleteEntry(sessionId, entry);
      }
    }

    const retainedInactiveEntries = [...entries.entries()]
      .filter(([, entry]) => entry.consumers === 0)
      .sort(([, left], [, right]) => left.lastTouched - right.lastTouched);

    while (retainedInactiveEntries.length > MESSAGE_CACHE_INACTIVE_LIMIT) {
      const oldest = retainedInactiveEntries.shift();
      if (!oldest) break;
      deleteEntry(oldest[0], oldest[1]);
    }
  }

  function handleMessageEvent(payload: MessageEventPayload): void {
    if (payload.type === "title_updated") return;

    const running = payload.type === "stream" || payload.status === "started";
    setSessionRunning(payload.sessionId, running);

    const existingEntry = entries.get(payload.sessionId);
    if (payload.type === "status" && payload.status !== "started" && !existingEntry) {
      pruneEntries();
      return;
    }

    const entry = existingEntry ?? getOrCreateEntry(payload.sessionId);
    entry.lastTouched = Date.now();

    if (payload.type === "stream") {
      entry.status = "started";
      if (entry.historyReady) {
        entry.timeline.value = applyMessageStreamEvent(entry.timeline.value, payload.event);
      } else {
        entry.bufferedEvents.push(payload.event);
      }
    } else {
      entry.status = payload.status;
    }

    pruneEntries();
  }

  async function loadMessages(
    workspaceId: number,
    sessionId: string,
    entry: MessageCacheEntry,
  ): Promise<void> {
    const generation = ++entry.loadGeneration;
    entry.loading.value = true;

    try {
      const response = await electronAPI.getMessageList({ workspaceId, sessionId });
      if (entries.get(sessionId) !== entry || generation !== entry.loadGeneration) return;

      let nextTimeline = createMessageTimeline(response.messages);
      for (const event of entry.bufferedEvents) {
        nextTimeline = applyMessageStreamEvent(nextTimeline, event);
      }
      entry.timeline.value = nextTimeline;
    } catch (error) {
      if (entries.get(sessionId) !== entry || generation !== entry.loadGeneration) return;
      console.error("读取消息记录失败:", error);

      let nextTimeline = createMessageTimeline();
      for (const event of entry.bufferedEvents) {
        nextTimeline = applyMessageStreamEvent(nextTimeline, event);
      }
      entry.timeline.value = nextTimeline;
    } finally {
      if (entries.get(sessionId) === entry && generation === entry.loadGeneration) {
        entry.bufferedEvents = [];
        entry.historyReady = true;
        entry.loading.value = false;
        entry.status ??= "completed";
        entry.lastTouched = Date.now();
        pruneEntries();
      }
    }
  }

  function acquire(workspaceId: number, sessionId: string): MessageCacheEntry {
    const entry = getOrCreateEntry(sessionId);
    entry.consumers += 1;
    entry.lastTouched = Date.now();

    if (!entry.historyReady && !entry.loading.value) {
      void loadMessages(workspaceId, sessionId, entry);
    }
    pruneEntries();
    return entry;
  }

  function release(sessionId: string, entry: MessageCacheEntry): void {
    if (entries.get(sessionId) !== entry) return;
    entry.consumers = Math.max(0, entry.consumers - 1);
    entry.lastTouched = Date.now();
    pruneEntries();
  }

  return {
    acquire,
    handleMessageEvent,
    release,
    runningSessionIds,
  };
});

export function useMessageListener(): void {
  const { handleMessageEvent } = useMessageState();
  const { addEventListener, removeEventListener, waitUntilReady } = useEventBus();

  onMounted(() => {
    addEventListener(MESSAGE_EVENT, handleMessageEvent);
    void waitUntilReady().catch((error) => {
      console.error("订阅消息事件失败:", error);
    });
  });

  onBeforeUnmount(() => {
    removeEventListener(MESSAGE_EVENT, handleMessageEvent);
  });
}

export function useMessageStatus() {
  const { runningSessionIds } = useMessageState();

  return {
    isSessionRunning: (sessionId: string) => runningSessionIds.value.has(sessionId),
  };
}

export function useSessionMessages(
  workspaceId: MaybeRefOrGetter<number | undefined>,
  sessionId: MaybeRefOrGetter<string | undefined>,
) {
  const { acquire, release } = useMessageState();
  const current = shallowRef<{ sessionId: string; entry: MessageCacheEntry }>();

  const stop = watch(
    () => [toValue(workspaceId), toValue(sessionId)] as const,
    ([nextWorkspaceId, nextSessionId]) => {
      const previous = current.value;
      if (previous) {
        release(previous.sessionId, previous.entry);
        current.value = undefined;
      }

      if (nextWorkspaceId === undefined || nextSessionId === undefined) return;
      current.value = {
        sessionId: nextSessionId,
        entry: acquire(nextWorkspaceId, nextSessionId),
      };
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    stop();
    const previous = current.value;
    if (previous) {
      release(previous.sessionId, previous.entry);
      current.value = undefined;
    }
  });

  return {
    timeline: computed(() => current.value?.entry.timeline.value ?? emptyTimeline),
    loading: computed(() => current.value?.entry.loading.value ?? false),
  };
}
