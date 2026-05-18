<script setup lang="ts">
import type { SendMessage, Session, Workspace } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import { PermissionApprovalPanel } from "@willow/ui";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, onBeforeMount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import MainTitle from "@/components/base/MainTitle.vue";
import { useAgentMessages } from "@/composables/useAgentMessages";
import { useDragResize } from "@/composables/useDragResize";
import { useTodoProgress } from "@/composables/useTodoProgress";
import { electronAPI } from "@/lib/ipc";
import ChatRightSidebar from "@/pages/chat/components/ChatRightSidebar.vue";
import SenderContainer from "@/pages/chat/components/SenderContainer.vue";
import { useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";

const sessionStore = useSessionStore();
const workspaceStore = useWorkspaceStore();
const { sessionMap } = storeToRefs(sessionStore);
const { workspaceList } = storeToRefs(workspaceStore);
const route = useRoute();
const router = useRouter();
const isSidebarOpen = ref(false);
const conversationSession = ref<Session | null>(null);
const conversationWorkspace = ref<Workspace | null>(null);

const CHAT_MAIN_MIN_WIDTH = 350;
const RIGHT_SIDEBAR_MIN_WIDTH = 240;
const RIGHT_SIDEBAR_DEFAULT_WIDTH = 320;
const routeSessionId = computed(() => {
  const value = Number(route.params.sessionId);
  return Number.isNaN(value) ? 0 : value;
});
const isConversationRoute = computed(() => route.name === "conversation");
const activeSessionId = computed(() =>
  isConversationRoute.value ? (conversationSession.value?.id ?? 0) : routeSessionId.value,
);

const { todos, restoreFromActiveStream } = useTodoProgress(activeSessionId);
const { state } = useAgentMessages(activeSessionId, {
  onActiveStreamLoaded: (activeStream) => {
    restoreFromActiveStream(activeStream.todos);
  },
});
const isSessionRoute = computed(() => route.name === "session");
const isWorkspaceRoute = computed(() => route.name === "workspace");
const currentWorkspaceId = computed(() => {
  if (isWorkspaceRoute.value) {
    const value = Number(route.query.workspaceId);
    return Number.isNaN(value) ? 0 : value;
  }
  if (isConversationRoute.value) {
    return conversationWorkspace.value?.id ?? conversationSession.value?.workspaceId ?? 0;
  }
  return currentSession.value?.workspaceId ?? 0;
});
const currentSession = computed(() => {
  if (isConversationRoute.value) {
    return conversationSession.value ?? undefined;
  }
  let foundSession: Session | undefined;

  Object.values(sessionMap.value).some((sessions) => {
    const session = sessions.find((item) => item.id === activeSessionId.value);
    if (!session) {
      return false;
    }
    foundSession = session;
    return true;
  });

  return foundSession;
});
const currentWorkspace = computed(() => {
  if (isConversationRoute.value) {
    return conversationWorkspace.value;
  }
  return workspaceList.value.find((workspace) => workspace.id === currentWorkspaceId.value);
});
const pageTitle = computed(() => {
  if (isConversationRoute.value) {
    return "对话";
  }
  if (isSessionRoute.value) {
    return currentSession.value?.title || "未命名会话";
  }
  return currentWorkspace.value?.name || "开始工作";
});
const messageCount = computed(() => {
  const streamMessageCount = state.streamMessage ? 1 : 0;
  return state.messages.length + streamMessageCount;
});

async function handleSend(request: SendMessage) {
  // 检查是否为 session 路由
  if (isSessionRoute.value || isConversationRoute.value) {
    const sessionId = activeSessionId.value;
    if (!sessionId) {
      return;
    }
    electronAPI.sendMessage({
      sessionId,
      ...request,
    });
    sessionStore.bumpSessionToTop(sessionId);
  } else {
    // 创建 session
    const workspaceId = Number(route.query.workspaceId);
    const { session } = await electronAPI.createSession({
      workspaceId: workspaceId,
    });

    sessionStore.fetchSessionList([workspaceId]);

    router.push(`/${session.id}`);
    electronAPI.sendMessage({
      sessionId: session.id,
      ...request,
    });
  }
}

async function handleStop() {
  if (!isSessionRoute.value && !isConversationRoute.value) {
    return;
  }
  await electronAPI.stopSessionStream({
    sessionId: activeSessionId.value,
  });
}

async function handleToolApproval(
  toolCallId: string,
  decision: "approved" | "rejected",
  reason?: string,
) {
  if (!isSessionRoute.value && !isConversationRoute.value) {
    return;
  }

  await electronAPI.resolveToolApproval({
    sessionId: activeSessionId.value,
    toolCallId,
    decision,
    reason,
  });
}

const pendingApprovals = computed(() =>
  Array.from(state.toolApprovals.values()).filter((a) => a.status === "pending"),
);

async function handleSkipApproval() {
  // Reject all pending approvals
  for (const approval of pendingApprovals.value) {
    await electronAPI.resolveToolApproval({
      sessionId: activeSessionId.value,
      toolCallId: approval.toolCallId,
      decision: "rejected",
    });
  }
  // Stop the session stream
  await handleStop();
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
}

const {
  width: sidebarWidth,
  isDragging,
  onMouseDown,
  onDblClick,
} = useDragResize({
  minWidth: RIGHT_SIDEBAR_MIN_WIDTH,
  maxWidth: Number.MAX_SAFE_INTEGER,
  defaultWidth: RIGHT_SIDEBAR_DEFAULT_WIDTH,
  storageKey: "sidebar-width",
});

const mainColumnStyle = computed(() => ({
  minWidth: isSidebarOpen.value ? `${CHAT_MAIN_MIN_WIDTH}px` : "0px",
}));

onBeforeMount(async () => {
  if (workspaceList.value.length === 0) {
    await workspaceStore.fetchWorkspaceList();
  }
});

watch(
  isConversationRoute,
  async (enabled) => {
    if (!enabled) {
      conversationSession.value = null;
      conversationWorkspace.value = null;
      return;
    }
    const data = await electronAPI.getConversationSession();
    conversationSession.value = data.session;
    conversationWorkspace.value = data.workspace;
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex min-h-0 flex-1 overflow-hidden">
      <div
        class="flex min-h-0 min-w-0 flex-1 flex-col items-center pb-3 pl-3"
        :style="mainColumnStyle"
      >
        <MainTitle>
          <div class="text-sm font-semibold">{{ pageTitle }}</div>
          <template #extra>
            <Button variant="ghost" size="icon" class="size-8" @click="toggleSidebar">
              <ChevronRight v-if="isSidebarOpen" class="size-4" />
              <ChevronLeft v-else class="size-4" />
            </Button>
          </template>
        </MainTitle>

        <div class="min-h-0 w-full min-w-0 flex-1">
          <RouterView v-slot="{ Component }">
            <component
              :is="Component"
              :messages="state.messages"
              :stream-message="state.streamMessage"
              :is-streaming="state.isStreaming"
              :tools="state.tools"
              :pending-tool-calls="state.pendingToolCalls"
              :tool-approvals="state.toolApprovals"
              :session-id-override="activeSessionId"
            />
          </RouterView>
        </div>

        <div class="relative w-full max-w-3xl min-w-0 pr-3">
          <PermissionApprovalPanel
            v-if="pendingApprovals.length > 0"
            :approvals="pendingApprovals"
            @approve="(id) => handleToolApproval(id, 'approved')"
            @reject="(id, reason) => handleToolApproval(id, 'rejected', reason)"
            @skip="handleSkipApproval"
            @close="handleSkipApproval"
          />
          <SenderContainer
            v-else
            :messages="state.messages"
            :stream-message="state.streamMessage"
            :is-streaming="state.isStreaming"
            :show-usage="isSessionRoute || isConversationRoute"
            :workspace-id="currentWorkspaceId"
            @send="handleSend"
            @stop="handleStop"
          />
        </div>
      </div>

      <div
        v-if="isSidebarOpen"
        class="relative h-full w-1 shrink-0 cursor-col-resize bg-transparent transition-colors select-none hover:bg-border/50"
        @mousedown="onMouseDown"
        @dblclick="onDblClick"
      >
        <div class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
      </div>

      <ChatRightSidebar
        :mode="isSessionRoute || isConversationRoute ? 'session' : 'workspace'"
        :open="isSidebarOpen"
        :width="sidebarWidth"
        :is-dragging="isDragging"
        :session="currentSession"
        :workspace="currentWorkspace"
        :message-count="messageCount"
        :todos="isSessionRoute ? todos : []"
      />
    </div>
  </div>
</template>
