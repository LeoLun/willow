<script setup lang="ts">
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ToolApproval, SendMessage } from "@shared/api";
import { Button } from "@willow/shadcn";
import { MessageList, StreamingMessageContainer } from "@willow/ui";
import { ArrowDown } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDialog } from "@/layout/dialog";
import { CreateWorkspace } from "@/layout/dialog/create-workspace";
import { useWorkspaceStore } from "@/stores/workspace";
import SenderContainer from "../components/SenderContainer.vue";
import WelcomeView from "./components/WelcomeView.vue";

const props = withDefaults(
  defineProps<{
    messages?: AgentMessage[];
    streamMessage?: AgentMessage | null;
    isStreaming?: boolean;
    tools?: any[];
    pendingToolCalls?: Set<string>;
    toolApprovals?: Map<string, ToolApproval>;
    sessionIdOverride?: number;
    workspaceId?: number;
    chatScope?: "conversation" | "workspace";
  }>(),
  {
    messages: () => [],
    streamMessage: null,
    isStreaming: false,
    tools: () => [],
    pendingToolCalls: () => new Set<string>(),
    toolApprovals: () => new Map<string, ToolApproval>(),
    sessionIdOverride: 0,
    workspaceId: 0,
    chatScope: "conversation",
  },
);

const emit = defineEmits<{
  (e: "send", request: SendMessage): void;
  (e: "stop"): void;
}>();

const route = useRoute();
const router = useRouter();
const workspaceStore = useWorkspaceStore();
const { openDialog } = useDialog();

const sessionId = computed(() => {
  if (props.sessionIdOverride) {
    return props.sessionIdOverride;
  }
  return Number(route.params.sessionId);
});

const showWelcome = computed(() => props.messages.length === 0 && !props.isStreaming);

const currentWorkspaceName = computed(() => {
  if (props.chatScope === "conversation") {
    return "对话";
  }
  const ws = workspaceStore.workspaceList.find((w) => w.id === props.workspaceId);
  return ws?.name ?? "工作空间";
});

function handleCreateWorkspace() {
  openDialog(CreateWorkspace, {
    onCreated: () => workspaceStore.fetchWorkspaceList(),
  });
}

function handleGoToSettings() {
  router.push("/setting/configuration");
}

function handleSelectWorkspace(id: number) {
  if (id === -1) {
    const conversationWorkspace = workspaceStore.workspaceList.find(
      (w) => w.kind === "conversation",
    );
    if (conversationWorkspace) {
      void router.push(`/?workspaceId=${conversationWorkspace.id}`);
    } else {
      void router.push("/conversation");
    }
  } else {
    void router.push(`/?workspaceId=${id}`);
  }
}

const scrollArea = ref<HTMLElement | null>(null);
const messageContainer = ref<HTMLElement | null>(null);
const shouldStickToBottom = ref(true);
let resizeObserver: ResizeObserver | null = null;

function isNearBottom() {
  const el = scrollArea.value;
  if (!el) return true;
  const threshold = 32;
  return el.scrollHeight - el.clientHeight - el.scrollTop <= threshold;
}

function forceScrollToBottom() {
  const el = scrollArea.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

function scheduleScrollToBottom() {
  if (!shouldStickToBottom.value) return;
  void nextTick(() => {
    if (!shouldStickToBottom.value) return;
    forceScrollToBottom();
    requestAnimationFrame(() => {
      if (!shouldStickToBottom.value) return;
      forceScrollToBottom();
    });
  });
}

function handleWheel() {
  requestAnimationFrame(() => {
    shouldStickToBottom.value = isNearBottom();
  });
}

function handleScroll() {
  if (!shouldStickToBottom.value && isNearBottom()) {
    shouldStickToBottom.value = true;
  }
}

function handleScrollToBottom() {
  shouldStickToBottom.value = true;
  forceScrollToBottom();
}

watch(scrollArea, (newEl, oldEl) => {
  if (oldEl) {
    oldEl.removeEventListener("scroll", handleScroll);
    oldEl.removeEventListener("wheel", handleWheel);
  }
  if (newEl) {
    newEl.addEventListener("scroll", handleScroll, { passive: true });
    newEl.addEventListener("wheel", handleWheel, { passive: true });
  }
});

watch(messageContainer, (newEl) => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (newEl && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      if (!shouldStickToBottom.value) return;
      scheduleScrollToBottom();
    });
    resizeObserver.observe(newEl);
  }
});

watch(
  sessionId,
  () => {
    shouldStickToBottom.value = true;
    void nextTick(() => {
      forceScrollToBottom();
      requestAnimationFrame(() => {
        forceScrollToBottom();
      });
    });
  },
  { immediate: true },
);

watch(
  () => [props.messages.length, props.streamMessage, props.isStreaming],
  () => {
    if (!shouldStickToBottom.value) return;
    scheduleScrollToBottom();
  },
  { flush: "post" },
);

onBeforeUnmount(() => {
  scrollArea.value?.removeEventListener("scroll", handleScroll);
  scrollArea.value?.removeEventListener("wheel", handleWheel);
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col items-center justify-center">
    <WelcomeView
      v-if="showWelcome"
      :current-workspace-name="currentWorkspaceName"
      :chat-scope="props.chatScope"
      :workspaces="workspaceStore.projectWorkspaceList"
      @create-workspace="handleCreateWorkspace"
      @go-to-settings="handleGoToSettings"
      @select-workspace="handleSelectWorkspace"
      class="w-full flex-1"
    >
      <template #sender>
        <SenderContainer
          :messages="props.messages"
          :stream-message="props.streamMessage"
          :is-streaming="props.isStreaming"
          :show-usage="false"
          :workspace-id="props.workspaceId"
          :chat-scope="props.chatScope"
          @send="(req) => emit('send', req)"
          @stop="() => emit('stop')"
        />
      </template>
    </WelcomeView>

    <div v-else class="relative min-h-0 w-full flex-1">
      <div ref="scrollArea" class="h-full overflow-y-auto pt-4 pb-10">
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

      <Transition name="scroll-bottom">
        <Button
          v-if="!shouldStickToBottom && !showWelcome"
          variant="outline"
          size="icon"
          class="absolute bottom-4 left-1/2 z-10 size-8 -translate-x-1/2 rounded-full bg-background shadow-sm"
          @click="handleScrollToBottom"
        >
          <ArrowDown class="size-4" />
        </Button>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.scroll-bottom-enter-active,
.scroll-bottom-leave-active {
  transition:
    opacity 200ms,
    transform 200ms;
}
.scroll-bottom-enter-from,
.scroll-bottom-leave-to {
  opacity: 0;
  transform: translate(0, 50%);
}
</style>
