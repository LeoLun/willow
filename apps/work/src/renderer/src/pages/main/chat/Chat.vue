<script setup lang="ts">
import type { ProviderInfo } from "@shared/api";
import { onClickOutside } from "@vueuse/core";
import { Button } from "@willow/shadcn/components/ui/button";
import { GaugeIcon } from "lucide-vue-next";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  useId,
  watch,
} from "vue";
import type { StyleValue } from "vue";
import { useRoute } from "vue-router";
import { MessageList } from "@/components/message-list";
import {
  calculateSessionUsage,
  SESSION_USAGE_KEY,
  SessionUsagePanel,
} from "@/components/session-usage";
import { useComposerPreferences } from "@/composables/useComposerPreferences";
import { useSessionMessages } from "@/composables/useMessage";
import { onProviderConfigurationChanged } from "@/lib/app-state-events";
import { electronAPI } from "@/lib/ipc";
import ChatFocusRail from "./ChatFocusRail.vue";

const SESSION_USAGE_PANEL_OPEN_STORAGE_KEY = "willow:session-usage-panel-open";

function loadSessionUsagePanelOpen(): boolean {
  try {
    return localStorage.getItem(SESSION_USAGE_PANEL_OPEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveSessionUsagePanelOpen(open: boolean): void {
  try {
    localStorage.setItem(SESSION_USAGE_PANEL_OPEN_STORAGE_KEY, String(open));
  } catch {
    // Ignore unavailable storage and keep the in-memory state usable.
  }
}

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
const toolbarActions = shallowRef<Element>();
const sessionUsagePanel = shallowRef<HTMLElement>();
const catalogProviders = shallowRef<ProviderInfo[]>([]);
const composerHeight = ref(0);
const chatLayoutWidth = ref(0);
const sessionUsagePanelOpen = ref(loadSessionUsagePanelOpen());
const sessionUsagePanelAnimated = ref(false);
const sessionUsagePanelId = useId();
let chatResizeObserver: ResizeObserver | undefined;
let chatResizeFrame: number | undefined;
let composerResizeObserver: ResizeObserver | undefined;
let messageResizeObserver: ResizeObserver | undefined;
let removeProviderConfigurationListener: (() => void) | undefined;
let shouldStickToBottom = true;
let previousScrollTop = 0;
let userScrollIntent = false;
let pointerScrollIntent = false;

const FOCUS_RAIL_MIN_USER_MESSAGES = 3;
const RAIL_SPAN_PX = 34;
const MIN_CHAT_PANE_WIDTH = 500;
const SESSION_USAGE_PANEL_WIDTH = 300;

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
const sessionUsagePanelFloating = computed(
  () =>
    chatLayoutWidth.value > 0 &&
    chatLayoutWidth.value < MIN_CHAT_PANE_WIDTH + SESSION_USAGE_PANEL_WIDTH,
);
const sessionUsagePanelLayoutOpen = computed(
  () => sessionUsagePanelOpen.value || sessionUsagePanelAnimated.value,
);
const chatLayoutStyle = computed<StyleValue>(() =>
  sessionUsagePanelLayoutOpen.value && !sessionUsagePanelFloating.value
    ? { gridTemplateColumns: `minmax(0, 1fr) ${SESSION_USAGE_PANEL_WIDTH}px` }
    : { gridTemplateColumns: "minmax(0, 1fr)" },
);
const sessionUsagePanelStyle = computed<StyleValue>(() =>
  sessionUsagePanelFloating.value
    ? {
        width: `${Math.max(0, Math.min(SESSION_USAGE_PANEL_WIDTH, chatLayoutWidth.value - 24))}px`,
      }
    : undefined,
);
const composerStyle = computed<StyleValue>(() =>
  sessionUsagePanelLayoutOpen.value && !sessionUsagePanelFloating.value
    ? { right: `${SESSION_USAGE_PANEL_WIDTH}px` }
    : { right: "0" },
);

function measureChatLayout(): void {
  chatLayoutWidth.value = chatLayout.value?.getBoundingClientRect().width ?? 0;
}

function scheduleChatLayoutWidth(width: number): void {
  if (chatResizeFrame !== undefined) cancelAnimationFrame(chatResizeFrame);
  chatResizeFrame = requestAnimationFrame(() => {
    chatResizeFrame = undefined;
    const nextWidth = Math.round(width);
    if (nextWidth !== chatLayoutWidth.value) chatLayoutWidth.value = nextWidth;
  });
}

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

function updateScrollAnchor(): void {
  const viewport = messageViewport.value;
  if (!viewport) return;
  const nextScrollTop = viewport.scrollTop;
  if (nextScrollTop < previousScrollTop - 1 && (userScrollIntent || pointerScrollIntent)) {
    shouldStickToBottom = false;
  } else if (viewport.scrollHeight - viewport.clientHeight - nextScrollTop <= 1) {
    shouldStickToBottom = true;
  }
  previousScrollTop = nextScrollTop;
  userScrollIntent = false;
}

function noteWheelIntent(event: WheelEvent): void {
  if (event.deltaY < 0) userScrollIntent = true;
}

function noteTouchIntent(): void {
  userScrollIntent = true;
}

function noteKeyboardIntent(event: KeyboardEvent): void {
  if (["ArrowUp", "Home", "PageUp"].includes(event.key)) userScrollIntent = true;
}

function beginPointerScroll(event: PointerEvent): void {
  if (event.target === event.currentTarget) pointerScrollIntent = true;
}

function endPointerScroll(): void {
  pointerScrollIntent = false;
}

function setSessionUsagePanelOpen(open: boolean, animated = false): void {
  sessionUsagePanelAnimated.value = animated;
  sessionUsagePanelOpen.value = open;
}

function toggleSessionUsagePanel(): void {
  setSessionUsagePanelOpen(!sessionUsagePanelOpen.value, true);
}

function finishSessionUsagePanelAnimation(): void {
  sessionUsagePanelAnimated.value = false;
}

onClickOutside(
  sessionUsagePanel,
  () => {
    if (sessionUsagePanelOpen.value && sessionUsagePanelFloating.value) {
      setSessionUsagePanelOpen(false);
    }
  },
  { ignore: ['[data-slot="session-usage-toggle"]'] },
);

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
  if (!shouldStickToBottom) return;
  await nextTick();
  scrollToBottom();
});
watch(
  sessionUsagePanelOpen,
  (open) => {
    if (open && catalogProviders.value.length === 0) void loadProviderCatalog();
    if (!sessionUsagePanelFloating.value) saveSessionUsagePanelOpen(open);
  },
  { immediate: true },
);
watch(sessionUsagePanelFloating, (floating, wasFloating) => {
  if (floating) {
    setSessionUsagePanelOpen(false);
  } else if (wasFloating) {
    setSessionUsagePanelOpen(loadSessionUsagePanelOpen());
  }
});

onMounted(() => {
  toolbarActions.value = document.querySelector('[data-slot="chat-toolbar-actions"]') ?? undefined;
  removeProviderConfigurationListener = onProviderConfigurationChanged(() => {
    if (sessionUsagePanelOpen.value) void loadProviderCatalog();
  });
  window.addEventListener("pointerup", endPointerScroll);
  window.addEventListener("pointercancel", endPointerScroll);
  updateComposerHeight();
  refreshFocusRailFit();
  measureChatLayout();
  if (typeof ResizeObserver === "undefined") return;

  if (chatLayout.value) {
    chatResizeObserver = new ResizeObserver(([entry]) => {
      if (entry) scheduleChatLayoutWidth(entry.contentRect.width);
    });
    chatResizeObserver.observe(chatLayout.value);
  }
  if (composer.value) {
    composerResizeObserver = new ResizeObserver(updateComposerHeight);
    composerResizeObserver.observe(composer.value);
  }
  if (messageContent.value) {
    messageResizeObserver = new ResizeObserver(() => {
      refreshFocusRailFit();
      if (shouldStickToBottom) scrollToBottom();
    });
    messageResizeObserver.observe(messageContent.value);
    if (messageViewport.value) messageResizeObserver.observe(messageViewport.value);
  }
});

onBeforeUnmount(() => {
  removeProviderConfigurationListener?.();
  window.removeEventListener("pointerup", endPointerScroll);
  window.removeEventListener("pointercancel", endPointerScroll);
  chatResizeObserver?.disconnect();
  if (chatResizeFrame !== undefined) cancelAnimationFrame(chatResizeFrame);
  composerResizeObserver?.disconnect();
  messageResizeObserver?.disconnect();
});
</script>

<template>
  <div
    ref="chatLayout"
    class="relative grid h-full min-h-0 overflow-hidden"
    data-slot="chat-layout"
    :style="chatLayoutStyle"
  >
    <Teleport v-if="toolbarActions" :to="toolbarActions">
      <Button
        :variant="sessionUsagePanelOpen ? 'secondary' : 'ghost'"
        size="icon-sm"
        :pressed="sessionUsagePanelOpen"
        :aria-controls="sessionUsagePanelId"
        :aria-expanded="sessionUsagePanelOpen"
        aria-label="切换会话信息面板"
        data-slot="session-usage-toggle"
        @click="toggleSessionUsagePanel"
      >
        <GaugeIcon />
      </Button>
    </Teleport>

    <div
      ref="messageViewport"
      class="col-start-1 row-start-1 h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable_both-edges]"
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
      class="absolute bottom-0 left-0 z-10 pb-2"
      :style="composerStyle"
      data-slot="chat-composer"
    >
      <div class="relative z-1 mx-auto w-full max-w-[50rem] px-4" data-slot="chat-composer-content">
        <slot />
      </div>
      <div class="absolute right-0 bottom-0 left-0 z-0 mx-2 h-10 bg-(--background)"></div>
    </div>

    <Transition
      :css="sessionUsagePanelAnimated"
      enter-active-class="transition duration-150 linear motion-reduce:transition-none"
      enter-from-class="-translate-y-2 translate-x-2 opacity-0"
      enter-to-class="translate-x-0 translate-y-0 opacity-100"
      leave-active-class="transition duration-150 linear motion-reduce:transition-none"
      leave-from-class="translate-x-0 translate-y-0 opacity-100"
      leave-to-class="-translate-y-2 translate-x-2 opacity-0"
      @after-enter="finishSessionUsagePanelAnimation"
      @after-leave="finishSessionUsagePanelAnimation"
    >
      <aside
        v-if="sessionUsagePanelOpen"
        :id="sessionUsagePanelId"
        ref="sessionUsagePanel"
        class="min-h-0 overflow-hidden p-3"
        :class="
          sessionUsagePanelFloating
            ? 'absolute top-[-10px] right-[-10px] z-40'
            : 'col-start-2 row-start-1'
        "
        :style="sessionUsagePanelStyle"
        :data-floating="sessionUsagePanelFloating"
        data-slot="session-usage-sidebar"
        aria-label="会话信息"
      >
        <SessionUsagePanel />
      </aside>
    </Transition>
  </div>
</template>
