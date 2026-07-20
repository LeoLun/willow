<script setup lang="ts">
import type { MessageEventPayload } from "@shared/api";
import { MESSAGE_EVENT } from "@shared/constants";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useEventBus } from "@/composables/useEventBus";
import { electronAPI } from "@/lib/ipc";
import { usePendingChatStore } from "@/stores/pending-chat.store";

type SendStatus = "idle" | "sending" | "completed" | "failed";

const route = useRoute();
const pendingChatStore = usePendingChatStore();
const { addEventListener, removeEventListener, waitUntilReady } = useEventBus();
const status = ref<SendStatus>("idle");
const errorMessage = ref("");
let active = false;

const sessionId = computed(() => {
  const value = route.params.sessionId;
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
});

const statusMessage = computed(() => {
  if (status.value === "sending") return "正在发送首条消息…";
  if (status.value === "completed") return "首条消息已发送。";
  if (status.value === "failed") return errorMessage.value;
  return "当前没有待发送的消息。";
});

function printMessageEvent(payload: MessageEventPayload) {
  if (payload.sessionId === sessionId.value) {
    console.log("[MESSAGE_EVENT]", payload);
  }
}

onMounted(async () => {
  active = true;
  addEventListener(MESSAGE_EVENT, printMessageEvent);

  try {
    await waitUntilReady();
  } catch (error) {
    console.error("订阅消息事件失败:", error);
    errorMessage.value = "订阅消息事件失败。";
    status.value = "failed";
    return;
  }
  if (!active) return;

  const currentSessionId = sessionId.value;
  if (!currentSessionId) {
    status.value = "failed";
    errorMessage.value = "会话 ID 无效。";
    return;
  }

  const pendingMessage = pendingChatStore.consume(currentSessionId);
  if (!pendingMessage) return;

  status.value = "sending";
  try {
    const response = await electronAPI.sendMessage({
      workspaceId: pendingMessage.workspaceId,
      sessionId: currentSessionId,
      content: pendingMessage.content,
      model: pendingMessage.model,
    });
    console.log("[SEND_MESSAGE]", response.message);
    status.value = "completed";
  } catch (error) {
    console.error("发送消息失败:", error);
    errorMessage.value = error instanceof Error && error.message ? error.message : "发送消息失败。";
    status.value = "failed";
  }
});

onBeforeUnmount(() => {
  active = false;
  removeEventListener(MESSAGE_EVENT, printMessageEvent);
});
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
    <p class="text-sm font-medium text-foreground">Chat</p>
    <p class="text-sm text-muted-foreground">{{ statusMessage }}</p>
  </div>
</template>
