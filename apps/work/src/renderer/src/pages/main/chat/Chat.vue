<script setup lang="ts">
import type { ProviderInfo } from "@shared/api";
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from "vue";
import type { StyleValue } from "vue";
import { useRoute } from "vue-router";
import { MessageList } from "@/components/message-list";
import {
  calculateSessionUsage,
  SESSION_USAGE_KEY,
  SessionUsageBar,
} from "@/components/session-usage";
import { useComposerPreferences } from "@/composables/useComposerPreferences";
import { useSessionMessages } from "@/composables/useMessage";
import { onProviderConfigurationChanged } from "@/lib/app-state-events";
import { electronAPI } from "@/lib/ipc";
import ChatFocusRail from "./ChatFocusRail.vue";

const props = withDefaults(
  defineProps<{
    streaming?: boolean;
  }>(),
  {
    streaming: false,
  },
);

const route = useRoute();
const composerPreferences = useComposerPreferences();
const chatLayout = shallowRef<HTMLElement>();
const messageViewport = shallowRef<HTMLElement>();
const messageContent = shallowRef<HTMLElement>();
const composer = shallowRef<HTMLElement>();
const catalogProviders = shallowRef<ProviderInfo[]>([]);
const composerHeight = ref(0);
let composerResizeObserver: ResizeObserver | undefined;
let messageResizeObserver: ResizeObserver | undefined;
let removeProviderConfigurationListener: (() => void) | undefined;
let shouldStickToBottom = true;
let previousScrollTop = 0;
let userScrollIntent = false;
let pointerScrollIntent = false;

const FOCUS_RAIL_MIN_USER_MESSAGES = 3;
const RAIL_SPAN_PX = 34;

const workspaceId = computed(() => {
  const value = Number(route.query.workspaceId);
  return Number.isInteger(value) && value > 0 ? value : undefined;
});

const sessionId = computed(() => {
  const value = route.params.sessionId;
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
});

const { timeline, loading } = useSessionMessages(workspaceId, sessionId);
const sessionUsage = computed(() =>
  calculateSessionUsage(
    timeline.value.messages,
    catalogProviders.value,
    composerPreferences.value.model,
  ),
);
provide(SESSION_USAGE_KEY, sessionUsage);
const userMessages = computed(() =>
  timeline.value.messages.filter((message) => message.role === "user"),
);
const focusRailFits = ref(true);
const showFocusRail = computed(
  () => focusRailFits.value && userMessages.value.length > FOCUS_RAIL_MIN_USER_MESSAGES,
);
const bottomSpacerStyle = computed<StyleValue>(() => ({
  height: `${composerHeight.value + 32}px`,
}));

async function loadProviderCatalog(): Promise<void> {
  if (typeof electronAPI?.getProviderCatalog !== "function") return;
  try {
    catalogProviders.value = (await electronAPI.getProviderCatalog()).providers;
  } catch (error) {
    console.error("读取模型上下文信息失败:", error);
  }
}

function refreshFocusRailFit(): void {
  const viewport = messageViewport.value;
  const content = messageContent.value;
  if (!viewport || !content) return;

  const viewportRect = viewport.getBoundingClientRect();
  const contentRect = content.getBoundingClientRect();
  if (viewportRect.width <= 0 || contentRect.width <= 0) return;

  focusRailFits.value = contentRect.left >= viewportRect.left + RAIL_SPAN_PX;
}

function noteFocusRailNavigation(): void {
  shouldStickToBottom = false;
}

function scrollToBottom(): void {
  const viewport = messageViewport.value;
  if (!viewport) return;
  viewport.scrollTop = viewport.scrollHeight;
  previousScrollTop = viewport.scrollTop;
  shouldStickToBottom = true;
}

let scrollFrame: number | undefined;

function scheduleScrollToBottom(): void {
  if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = undefined;
    scrollToBottom();
  });
}

let lastUserScrollTime = 0;
let lastContentWidth = 0;
let lastViewportWidth = 0;

function updateScrollAnchor(): void {
  const viewport = messageViewport.value;
  if (!viewport) return;
  const nextScrollTop = viewport.scrollTop;
  const isUserScrolling =
    userScrollIntent || pointerScrollIntent || Date.now() - lastUserScrollTime < 500;

  if (nextScrollTop < previousScrollTop - 1 && isUserScrolling) {
    shouldStickToBottom = false;
  } else if (viewport.scrollHeight - viewport.clientHeight - nextScrollTop <= 1) {
    shouldStickToBottom = true;
  }
  previousScrollTop = nextScrollTop;
  userScrollIntent = false;
}

function noteWheelIntent(event: WheelEvent): void {
  if (event.deltaY < 0) {
    userScrollIntent = true;
    lastUserScrollTime = Date.now();
  }
}

function noteTouchIntent(): void {
  userScrollIntent = true;
  lastUserScrollTime = Date.now();
}

function noteKeyboardIntent(event: KeyboardEvent): void {
  if (["ArrowUp", "Home", "PageUp"].includes(event.key)) {
    userScrollIntent = true;
    lastUserScrollTime = Date.now();
  }
}

function beginPointerScroll(event: PointerEvent): void {
  if (event.target === event.currentTarget) pointerScrollIntent = true;
}

function endPointerScroll(): void {
  pointerScrollIntent = false;
}

function updateComposerHeight(): void {
  const root = composer.value;
  if (!root) return;

  const wasAtBottom = shouldStickToBottom;
  const nextHeight = root.offsetHeight;
  if (composerHeight.value === nextHeight) return;

  composerHeight.value = nextHeight;
  if (wasAtBottom) scheduleScrollToBottom();
}

function handleMessageResize(entries?: ResizeObserverEntry[]): void {
  let widthChanged = false;
  if (entries && entries.length > 0) {
    for (const entry of entries) {
      if (entry.target === messageContent.value) {
        const width = entry.contentRect.width;
        if (width !== lastContentWidth) {
          lastContentWidth = width;
          widthChanged = true;
        }
      } else if (entry.target === messageViewport.value) {
        const width = entry.contentRect.width;
        if (width !== lastViewportWidth) {
          lastViewportWidth = width;
          widthChanged = true;
        }
      }
    }
  } else {
    widthChanged = true;
  }

  if (widthChanged) {
    refreshFocusRailFit();
  }
  if (shouldStickToBottom) scrollToBottom();
}

watch([timeline, () => props.streaming], () => {
  if (shouldStickToBottom) scheduleScrollToBottom();
});

onMounted(() => {
  void loadProviderCatalog();
  removeProviderConfigurationListener = onProviderConfigurationChanged(() => {
    void loadProviderCatalog();
  });
  window.addEventListener("pointerup", endPointerScroll);
  window.addEventListener("pointercancel", endPointerScroll);
  updateComposerHeight();
  refreshFocusRailFit();
  if (typeof ResizeObserver === "undefined") return;

  if (composer.value) {
    composerResizeObserver = new ResizeObserver(updateComposerHeight);
    composerResizeObserver.observe(composer.value);
  }
  if (messageContent.value) {
    messageResizeObserver = new ResizeObserver((entries) => {
      handleMessageResize(entries);
    });
    messageResizeObserver.observe(messageContent.value);
    if (messageViewport.value) messageResizeObserver.observe(messageViewport.value);
  }
});

onBeforeUnmount(() => {
  removeProviderConfigurationListener?.();
  window.removeEventListener("pointerup", endPointerScroll);
  window.removeEventListener("pointercancel", endPointerScroll);
  if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
  composerResizeObserver?.disconnect();
  messageResizeObserver?.disconnect();
});
</script>

<template>
  <div ref="chatLayout" class="relative h-full min-h-0 overflow-hidden" data-slot="chat-layout">
    <div
      ref="messageViewport"
      class="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable_both-edges]"
      data-slot="chat-messages"
      tabindex="-1"
      @scroll="updateScrollAnchor"
      @wheel.passive="noteWheelIntent"
      @touchstart.passive="noteTouchIntent"
      @keydown="noteKeyboardIntent"
      @pointerdown="beginPointerScroll"
    >
      <div
        ref="messageContent"
        class="mx-auto flex min-h-full w-full max-w-[50rem] flex-col px-4 pt-6"
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
        <MessageList
          v-else
          :messages="timeline.messages"
          :streaming="props.streaming"
          :scroll-element="messageViewport"
        />
        <div
          class="shrink-0"
          data-slot="chat-bottom-spacer"
          :style="bottomSpacerStyle"
          aria-hidden="true"
        ></div>
      </div>
    </div>

    <ChatFocusRail
      v-if="showFocusRail"
      :messages="timeline.messages"
      :scroll-element="messageViewport"
      @navigate="noteFocusRailNavigation"
    />

    <div
      ref="composer"
      class="absolute right-0 bottom-0 left-0 z-10 pb-2"
      data-slot="chat-composer"
    >
      <div class="relative z-1 mx-auto w-full max-w-[50rem] px-4" data-slot="chat-composer-content">
        <slot />
        <SessionUsageBar :usage="sessionUsage" />
      </div>
      <div class="absolute right-0 bottom-0 left-0 z-0 mx-2 h-10 bg-(--background)"></div>
    </div>
  </div>
</template>
