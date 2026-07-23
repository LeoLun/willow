<script setup lang="ts">
import type { MessageEventPayload, MessageStreamEvent, SessionStatus } from "@shared/api";
import { MESSAGE_EVENT } from "@shared/constants";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import {
  applyMessageStreamEvent,
  createMessageTimeline,
  MessageList,
  type MessageTimeline,
} from "@/components/message-list";
import { useEventBus } from "@/composables/useEventBus";
import { electronAPI } from "@/lib/ipc";

type SendStatus = "idle" | SessionStatus;

const route = useRoute();
const { addEventListener, removeEventListener, waitUntilReady } = useEventBus();
const status = ref<SendStatus>("idle");
const errorMessage = ref("");
const loading = ref(false);
const timeline = shallowRef<MessageTimeline>(createMessageTimeline());
const messageViewport = ref<HTMLElement>();
let bufferedEvents: MessageStreamEvent[] = [];
let historyReady = false;
let loadGeneration = 0;
let active = false;
let stopRouteWatch: (() => void) | undefined;

const workspaceId = computed(() => {
  const value = Number(route.query.workspaceId);
  return Number.isInteger(value) && value > 0 ? value : undefined;
});

const sessionId = computed(() => {
  const value = route.params.sessionId;
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
});

const statusMessage = computed(() => {
  if (status.value === "started") return "正在发送消息…";
  if (status.value === "completed") return "消息已发送。";
  if (status.value === "stopped") return "消息生成已停止。";
  if (status.value === "failed") return errorMessage.value || "发送消息失败。";
  return "当前没有正在发送的消息。";
});

function handleMessageEvent(payload: MessageEventPayload) {
  if (payload.sessionId !== sessionId.value) return;

  if (payload.type === "stream") {
    if (!historyReady) {
      bufferedEvents.push(payload.event);
      return;
    }
    timeline.value = applyMessageStreamEvent(timeline.value, payload.event);
    return;
  }
  if (payload.type !== "status") return;

  status.value = payload.status;
  errorMessage.value = payload.status === "failed" ? (payload.error ?? "发送消息失败。") : "";
}

async function loadMessages(): Promise<void> {
  const currentWorkspaceId = workspaceId.value;
  const currentSessionId = sessionId.value;
  const generation = ++loadGeneration;

  timeline.value = createMessageTimeline();
  bufferedEvents = [];
  historyReady = false;
  loading.value = false;
  status.value = "idle";
  errorMessage.value = "";

  if (!currentWorkspaceId || !currentSessionId) {
    historyReady = true;
    return;
  }

  loading.value = true;
  try {
    const response = await electronAPI.getMessageList({
      workspaceId: currentWorkspaceId,
      sessionId: currentSessionId,
    });
    if (!active || generation !== loadGeneration) return;

    let nextTimeline = createMessageTimeline(response.messages);
    for (const event of bufferedEvents) {
      nextTimeline = applyMessageStreamEvent(nextTimeline, event);
    }
    timeline.value = nextTimeline;
  } catch (error) {
    if (!active || generation !== loadGeneration) return;
    console.error("读取消息记录失败:", error);

    let nextTimeline = createMessageTimeline();
    for (const event of bufferedEvents) {
      nextTimeline = applyMessageStreamEvent(nextTimeline, event);
    }
    timeline.value = nextTimeline;
  } finally {
    if (active && generation === loadGeneration) {
      bufferedEvents = [];
      historyReady = true;
      loading.value = false;
    }
  }
}

watch(timeline, async () => {
  await nextTick();
  const viewport = messageViewport.value;
  if (viewport) viewport.scrollTop = viewport.scrollHeight;
});

onMounted(async () => {
  active = true;
  addEventListener(MESSAGE_EVENT, handleMessageEvent);

  try {
    await waitUntilReady();
  } catch (error) {
    if (!active) return;
    console.error("订阅消息事件失败:", error);
    errorMessage.value = "订阅消息事件失败。";
    status.value = "failed";
    return;
  }

  stopRouteWatch = watch([workspaceId, sessionId], () => void loadMessages(), {
    immediate: true,
  });
});

onBeforeUnmount(() => {
  active = false;
  loadGeneration += 1;
  stopRouteWatch?.();
  removeEventListener(MESSAGE_EVENT, handleMessageEvent);
});
</script>

<template>
  <div
    class="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden"
    data-slot="chat-layout"
  >
    <div
      ref="messageViewport"
      class="min-h-0 overflow-y-auto overscroll-contain"
      data-slot="chat-messages"
    >
      <div class="mx-auto flex min-h-full w-full max-w-3xl flex-col pt-6 pb-[148px]">
        <div
          v-if="loading"
          class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
        >
          正在读取消息…
        </div>
        <div
          v-else-if="timeline.messages.length === 0"
          class="flex flex-1 flex-col items-center justify-center text-center"
        >
          <p class="text-sm font-medium text-foreground">暂无消息</p>
          <p class="text-sm text-muted-foreground">发送一条消息开始会话。</p>
        </div>
        <MessageList v-else :messages="timeline.messages" />
      </div>
    </div>

    <div class="absolute bottom-0 z-10 w-full shrink-0 px-8 pb-2" data-slot="chat-composer">
      <div class="relative z-1 mx-auto w-full max-w-3xl">
        <slot />
      </div>
      <div class="absolute right-0 bottom-0 left-0 z-0 mx-2 h-10 bg-(--background)"></div>
    </div>
  </div>
</template>
