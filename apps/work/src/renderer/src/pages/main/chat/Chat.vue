<script setup lang="ts">
import type { MessageEventPayload, SessionStatus } from "@shared/api";
import { MESSAGE_EVENT } from "@shared/constants";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useEventBus } from "@/composables/useEventBus";

type SendStatus = "idle" | SessionStatus;

const route = useRoute();
const { addEventListener, removeEventListener, waitUntilReady } = useEventBus();
const status = ref<SendStatus>("idle");
const errorMessage = ref("");
let active = false;

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

  console.log("[MESSAGE_EVENT]", payload);
  if (payload.type !== "status") return;

  status.value = payload.status;
  errorMessage.value = payload.status === "failed" ? (payload.error ?? "发送消息失败。") : "";
}

watch(sessionId, () => {
  status.value = "idle";
  errorMessage.value = "";
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

  if (!sessionId.value) {
    errorMessage.value = "会话 ID 无效。";
    status.value = "failed";
  }
});

onBeforeUnmount(() => {
  active = false;
  removeEventListener(MESSAGE_EVENT, handleMessageEvent);
});
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center gap-2 text-center">
    <p class="text-sm font-medium text-foreground">Chat</p>
    <p class="text-sm text-muted-foreground">{{ statusMessage }}</p>
  </div>
</template>
