<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import type { StyleValue } from "vue";
import { useRoute } from "vue-router";
import { MessageList } from "@/components/message-list";
import { useSessionMessages } from "@/composables/useMessage";

const route = useRoute();
const messageViewport = shallowRef<HTMLElement>();
const composer = shallowRef<HTMLElement>();
const composerHeight = ref(0);
let composerResizeObserver: ResizeObserver | undefined;

const workspaceId = computed(() => {
  const value = Number(route.query.workspaceId);
  return Number.isInteger(value) && value > 0 ? value : undefined;
});

const sessionId = computed(() => {
  const value = route.params.sessionId;
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
});

const { timeline, loading } = useSessionMessages(workspaceId, sessionId);
const messageContentStyle = computed<StyleValue>(() => ({
  paddingBottom: `${composerHeight.value}px`,
}));

function scrollToBottom(): void {
  const viewport = messageViewport.value;
  if (viewport) viewport.scrollTop = viewport.scrollHeight;
}

function updateComposerHeight(): void {
  const root = composer.value;
  if (!root) return;

  const viewport = messageViewport.value;
  const wasAtBottom = viewport
    ? viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 1
    : false;
  const nextHeight = root.offsetHeight;
  if (composerHeight.value === nextHeight) return;

  composerHeight.value = nextHeight;
  if (wasAtBottom) void nextTick(scrollToBottom);
}

watch(timeline, async () => {
  await nextTick();
  scrollToBottom();
});

onMounted(() => {
  updateComposerHeight();
  if (typeof ResizeObserver === "undefined" || !composer.value) return;
  composerResizeObserver = new ResizeObserver(updateComposerHeight);
  composerResizeObserver.observe(composer.value);
});

onBeforeUnmount(() => composerResizeObserver?.disconnect());
</script>

<template>
  <div class="relative h-full min-h-0 overflow-hidden" data-slot="chat-layout">
    <div
      ref="messageViewport"
      class="h-full min-h-0 overflow-y-auto overscroll-contain"
      data-slot="chat-messages"
    >
      <div
        class="mx-auto flex min-h-full w-full max-w-3xl flex-col pt-6"
        :style="messageContentStyle"
      >
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

    <div
      ref="composer"
      class="absolute right-0 bottom-0 left-0 z-10 w-full px-8 pb-2"
      data-slot="chat-composer"
    >
      <div class="relative z-1 mx-auto w-full max-w-3xl">
        <slot />
      </div>
      <div class="absolute right-0 bottom-0 left-0 z-0 mx-2 h-10 bg-(--background)"></div>
    </div>
  </div>
</template>
