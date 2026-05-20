<script setup lang="ts">
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ToolApproval } from "@shared/api";
import { MessageList, StreamingMessageContainer } from "@willow/ui";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

const props = withDefaults(
  defineProps<{
    messages?: AgentMessage[];
    streamMessage?: AgentMessage | null;
    isStreaming?: boolean;
    tools?: any[];
    pendingToolCalls?: Set<string>;
    toolApprovals?: Map<string, ToolApproval>;
    sessionIdOverride?: number;
  }>(),
  {
    messages: () => [],
    streamMessage: null,
    isStreaming: false,
    tools: () => [],
    pendingToolCalls: () => new Set<string>(),
    toolApprovals: () => new Map<string, ToolApproval>(),
    sessionIdOverride: 0,
  },
);
const route = useRoute();
const sessionId = computed(() => {
  if (props.sessionIdOverride) {
    return props.sessionIdOverride;
  }
  return Number(route.params.sessionId);
});

const scrollArea = ref<HTMLElement | null>(null);
const messageContainer = ref<HTMLElement | null>(null);
const shouldStickToBottom = ref(true);
let resizeObserver: ResizeObserver | null = null;

function isNearBottom() {
  const el = scrollArea.value;
  if (!el) {
    return true;
  }
  const threshold = 32;
  return el.scrollHeight - el.clientHeight - el.scrollTop <= threshold;
}

function scrollToBottom() {
  const el = scrollArea.value;
  if (!el) {
    return;
  }
  el.scrollTop = el.scrollHeight;
}

function scheduleScrollToBottom() {
  void nextTick(() => {
    scrollToBottom();
    requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    });
  });
}

function handleScroll() {
  shouldStickToBottom.value = isNearBottom();
}

watch(
  sessionId,
  () => {
    shouldStickToBottom.value = true;
    scheduleScrollToBottom();
  },
  { immediate: true },
);

watch(
  () => [props.messages.length, props.streamMessage, props.isStreaming],
  () => {
    if (!shouldStickToBottom.value) {
      return;
    }
    scheduleScrollToBottom();
  },
  { flush: "post" },
);

onMounted(() => {
  const el = scrollArea.value;
  if (el) {
    el.addEventListener("scroll", handleScroll, { passive: true });
  }

  if (messageContainer.value && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      if (!shouldStickToBottom.value) {
        return;
      }
      scheduleScrollToBottom();
    });
    resizeObserver.observe(messageContainer.value);
  }
});

onBeforeUnmount(() => {
  scrollArea.value?.removeEventListener("scroll", handleScroll);
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col items-center">
    <div ref="scrollArea" class="min-h-0 w-full flex-1 overflow-y-auto pt-4 pb-10">
      <div ref="messageContainer" class="mx-auto flex max-w-3xl flex-col gap-3 px-4">
        <MessageList
          :messages="props.messages"
          :tools="props.tools"
          :is-streaming="props.isStreaming"
          :pending-tool-calls="props.pendingToolCalls"
          :tool-approvals="props.toolApprovals"
        />

        <StreamingMessageContainer
          v-if="props.isStreaming"
          :message="props.streamMessage"
          :is-streaming="props.isStreaming"
          :tools="props.tools"
          :pending-tool-calls="props.pendingToolCalls"
          :tool-approvals="props.toolApprovals"
        />
      </div>
    </div>
  </div>
</template>
