<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import type { StyleValue } from "vue";
import { useRoute } from "vue-router";
import { MessageList } from "@/components/message-list";
import { useSessionMessages } from "@/composables/useMessage";

const props = withDefaults(
  defineProps<{
    streaming?: boolean;
  }>(),
  {
    streaming: false,
  },
);

const route = useRoute();
const messageViewport = shallowRef<HTMLElement>();
const messageContent = shallowRef<HTMLElement>();
const composer = shallowRef<HTMLElement>();
const composerHeight = ref(0);
let composerResizeObserver: ResizeObserver | undefined;
let messageResizeObserver: ResizeObserver | undefined;
let shouldStickToBottom = true;
let previousScrollTop = 0;

const workspaceId = computed(() => {
  const value = Number(route.query.workspaceId);
  return Number.isInteger(value) && value > 0 ? value : undefined;
});

const sessionId = computed(() => {
  const value = route.params.sessionId;
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
});

const { timeline, loading } = useSessionMessages(workspaceId, sessionId);
const bottomSpacerStyle = computed<StyleValue>(() => ({
  height: `${composerHeight.value + 32}px`,
}));

function scrollToBottom(): void {
  const viewport = messageViewport.value;
  if (!viewport) return;
  viewport.scrollTop = viewport.scrollHeight;
  previousScrollTop = viewport.scrollTop;
  shouldStickToBottom = true;
}

function updateScrollAnchor(): void {
  const viewport = messageViewport.value;
  if (!viewport) return;
  const nextScrollTop = viewport.scrollTop;
  if (nextScrollTop < previousScrollTop - 1) {
    shouldStickToBottom = false;
  } else if (viewport.scrollHeight - viewport.clientHeight - nextScrollTop <= 1) {
    shouldStickToBottom = true;
  }
  previousScrollTop = nextScrollTop;
}

function updateComposerHeight(): void {
  const root = composer.value;
  if (!root) return;

  const wasAtBottom = shouldStickToBottom;
  const nextHeight = root.offsetHeight;
  if (composerHeight.value === nextHeight) return;

  composerHeight.value = nextHeight;
  if (wasAtBottom) void nextTick(scrollToBottom);
}

watch([timeline, () => props.streaming], async () => {
  await nextTick();
  scrollToBottom();
});

onMounted(() => {
  updateComposerHeight();
  if (typeof ResizeObserver === "undefined") return;

  if (composer.value) {
    composerResizeObserver = new ResizeObserver(updateComposerHeight);
    composerResizeObserver.observe(composer.value);
  }
  if (messageContent.value) {
    messageResizeObserver = new ResizeObserver(() => {
      if (shouldStickToBottom) scrollToBottom();
    });
    messageResizeObserver.observe(messageContent.value);
  }
});

onBeforeUnmount(() => {
  composerResizeObserver?.disconnect();
  messageResizeObserver?.disconnect();
});
</script>

<template>
  <div class="relative h-full min-h-0 overflow-hidden" data-slot="chat-layout">
    <div
      ref="messageViewport"
      class="h-full min-h-0 overflow-y-auto overscroll-contain"
      data-slot="chat-messages"
      @scroll="updateScrollAnchor"
    >
      <div
        ref="messageContent"
        class="mx-auto flex min-h-full w-full max-w-3xl flex-col pt-6"
        data-slot="chat-message-content"
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
        <MessageList v-else :messages="timeline.messages" :streaming="props.streaming" />
        <div
          class="shrink-0"
          data-slot="chat-bottom-spacer"
          :style="bottomSpacerStyle"
          aria-hidden="true"
        ></div>
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
