<script setup lang="ts">
import type { SendMessage, Session, Workspace } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import { PermissionApprovalPanel, AskUserPanel } from "@willow/ui";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, onBeforeMount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
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
const fetchedSession = ref<Session | null>(null);
const fetchedWorkspace = ref<Workspace | null>(null);

// 缓存活跃的路由信息，当在设置页面时冻结更新，避免返回时触发重新获取数据和重新渲染
const activeRouteName = ref(route.name);
const activeRouteParams = ref({ ...route.params });
const activeRouteQuery = ref({ ...route.query });

watch(
  () => route.path,
  (newPath) => {
    if (!newPath.startsWith("/setting")) {
      activeRouteName.value = route.name;
      activeRouteParams.value = { ...route.params };
      activeRouteQuery.value = { ...route.query };
    }
  },
  { immediate: true },
);

const CHAT_MAIN_MIN_WIDTH = 350;
const RIGHT_SIDEBAR_MIN_WIDTH = 240;
const RIGHT_SIDEBAR_DEFAULT_WIDTH = 320;
const routeSessionId = computed(() => {
  const value = Number(activeRouteParams.value.sessionId);
  return Number.isNaN(value) ? 0 : value;
});
const isConversationRoute = computed(() => {
  if (activeRouteName.value === "conversation") {
    return true;
  }
  if (activeRouteName.value === "workspace") {
    const wsId = Number(activeRouteQuery.value.workspaceId);
    const ws = workspaceList.value.find((w) => w.id === wsId);
    return ws?.kind === "conversation";
  }
  if (activeRouteName.value === "session") {
    const ws = workspaceList.value.find((w) => w.id === currentSession.value?.workspaceId);
    return ws?.kind === "conversation";
  }
  return false;
});
const activeSessionId = computed(() =>
  activeRouteName.value === "conversation"
    ? (conversationSession.value?.id ?? 0)
    : routeSessionId.value,
);

const { todos, restoreFromActiveStream } = useTodoProgress(activeSessionId);
const { state } = useAgentMessages(activeSessionId, {
  onActiveStreamLoaded: (activeStream) => {
    restoreFromActiveStream(activeStream.todos);
  },
});
const isSessionRoute = computed(() => activeRouteName.value === "session");
const isWorkspaceRoute = computed(() => activeRouteName.value === "workspace");
const currentWorkspaceId = computed(() => {
  if (isWorkspaceRoute.value) {
    const value = Number(activeRouteQuery.value.workspaceId);
    return Number.isNaN(value) ? 0 : value;
  }
  if (activeRouteName.value === "conversation") {
    return conversationWorkspace.value?.id ?? conversationSession.value?.workspaceId ?? 0;
  }
  return currentSession.value?.workspaceId ?? 0;
});
const currentSession = computed(() => {
  if (activeRouteName.value === "conversation") {
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

  if (!foundSession && fetchedSession.value?.id === activeSessionId.value) {
    return fetchedSession.value;
  }

  return foundSession;
});
const currentWorkspace = computed(() => {
  if (activeRouteName.value === "conversation") {
    return conversationWorkspace.value;
  }
  const ws = workspaceList.value.find((workspace) => workspace.id === currentWorkspaceId.value);
  if (!ws && fetchedWorkspace.value?.id === currentWorkspaceId.value) {
    return fetchedWorkspace.value;
  }
  return ws;
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
const showBottomSender = computed(() => {
  return messageCount.value > 0 || state.isStreaming;
});

async function handleSend(request: SendMessage) {
  console.log("[Chat] handleSend sessionId=", activeSessionId.value);
  try {
    if (isSessionRoute.value || (isConversationRoute.value && activeSessionId.value !== 0)) {
      const sessionId = activeSessionId.value;
      if (!sessionId) {
        console.warn("[Chat] handleSend no sessionId, aborting");
        return;
      }
      console.log("[Chat] sendMessage to sessionId=", sessionId);
      await electronAPI.sendMessage({
        sessionId,
        ...request,
      });
      sessionStore.bumpSessionToTop(sessionId);
      return;
    }

    const workspaceId = Number(activeRouteQuery.value.workspaceId) || currentWorkspaceId.value;
    console.log("[Chat] creating new session for workspaceId=", workspaceId);
    const { session } = await electronAPI.createSession({
      workspaceId,
    });

    sessionStore.fetchSessionList([workspaceId]);

    await router.push(`/${session.id}`);
    console.log("[Chat] sendMessage to new sessionId=", session.id);
    await electronAPI.sendMessage({
      sessionId: session.id,
      ...request,
    });
  } catch (error) {
    console.error("[Chat] handleSend error:", error);
    const message = error instanceof Error ? error.message : "发送失败，请稍后重试";
    toast.error(message);
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

const pendingAskUser = computed(() =>
  Array.from(state.toolApprovals.values()).find(
    (a) => a.toolName === "ask_user" && a.status === "pending",
  ),
);

const pendingApprovals = computed(() =>
  Array.from(state.toolApprovals.values()).filter(
    (a) => a.status === "pending" && a.toolName !== "ask_user",
  ),
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
  () => [isConversationRoute.value, activeRouteQuery.value.sessionId],
  async ([enabled, qSessionId]) => {
    if (!enabled) {
      conversationSession.value = null;
      conversationWorkspace.value = null;
      return;
    }
    const sessionId = qSessionId ? Number(qSessionId) : undefined;
    const data = await electronAPI.getConversationSession(sessionId ? { sessionId } : undefined);
    conversationSession.value = data.session;
    conversationWorkspace.value = data.workspace;
  },
  { immediate: true },
);

watch(
  () => [isSessionRoute.value, activeSessionId.value, currentSession.value] as const,
  async ([isSession, sessionId, session]) => {
    if (!isSession || !sessionId || session) {
      if (!isSession) {
        fetchedSession.value = null;
        fetchedWorkspace.value = null;
      }
      return;
    }
    try {
      const data = await electronAPI.getSession({ sessionId });
      fetchedSession.value = data.session;
      fetchedWorkspace.value = data.workspace;
    } catch (e) {
      console.error("[Chat] getSession fallback failed", e);
    }
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
              :workspace-id="currentWorkspaceId"
              :chat-scope="isConversationRoute ? 'conversation' : 'workspace'"
              @send="handleSend"
              @stop="handleStop"
            />
          </RouterView>
        </div>

        <div class="relative w-full max-w-3xl min-w-0 pr-3">
          <AskUserPanel
            v-if="pendingAskUser"
            :approval="pendingAskUser"
            @resolve="
              (decision, answer) => handleToolApproval(pendingAskUser.toolCallId, decision, answer)
            "
            @close="handleToolApproval(pendingAskUser.toolCallId, 'rejected')"
          />
          <PermissionApprovalPanel
            v-else-if="pendingApprovals.length > 0"
            :approvals="pendingApprovals"
            @approve="(id) => handleToolApproval(id, 'approved')"
            @reject="(id, reason) => handleToolApproval(id, 'rejected', reason)"
            @skip="handleSkipApproval"
            @close="handleSkipApproval"
          />
          <SenderContainer
            v-else-if="showBottomSender"
            :messages="state.messages"
            :stream-message="state.streamMessage"
            :is-streaming="state.isStreaming"
            :show-usage="isSessionRoute || isConversationRoute"
            :workspace-id="currentWorkspaceId"
            :chat-scope="isConversationRoute ? 'conversation' : 'workspace'"
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
