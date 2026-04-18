<script setup lang="ts">
import type { SendMessage, Session } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, onBeforeMount, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import MainTitle from "@/components/base/MainTitle.vue";
import { useAgentMessages } from "@/composables/useAgentMessages";
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
const sessionId = computed(() => {
  const value = Number(route.params.sessionId);
  return Number.isNaN(value) ? 0 : value;
});

const { todos, restoreFromActiveStream } = useTodoProgress(sessionId);
const { state } = useAgentMessages(sessionId, {
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
  return currentSession.value?.workspaceId ?? 0;
});
const currentSession = computed(() => {
  let foundSession: Session | undefined;

  Object.values(sessionMap.value).some((sessions) => {
    const session = sessions.find((item) => item.id === sessionId.value);
    if (!session) {
      return false;
    }
    foundSession = session;
    return true;
  });

  return foundSession;
});
const currentWorkspace = computed(() =>
  workspaceList.value.find((workspace) => workspace.id === currentWorkspaceId.value),
);
const pageTitle = computed(() => {
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
  if (isSessionRoute.value) {
    const sessionId = Number(route.params.sessionId);
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
  if (!isSessionRoute.value) {
    return;
  }
  await electronAPI.stopSessionStream({
    sessionId: sessionId.value,
  });
}

async function handleToolApproval(toolCallId: string, decision: "approved" | "rejected") {
  if (!isSessionRoute.value) {
    return;
  }

  await electronAPI.resolveToolApproval({
    sessionId: sessionId.value,
    toolCallId,
    decision,
  });
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
}

onBeforeMount(async () => {
  if (workspaceList.value.length === 0) {
    await workspaceStore.fetchWorkspaceList();
  }
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex min-h-0 flex-1">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col items-center pb-3 pl-3">
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
              :on-approve-tool-call="
                (toolCallId: string) => handleToolApproval(toolCallId, 'approved')
              "
              :on-reject-tool-call="
                (toolCallId: string) => handleToolApproval(toolCallId, 'rejected')
              "
            />
          </RouterView>
        </div>

        <div class="relative w-full max-w-3xl min-w-0 pr-3">
          <SenderContainer
            :messages="state.messages"
            :stream-message="state.streamMessage"
            :is-streaming="state.isStreaming"
            :show-usage="isSessionRoute"
            :workspace-id="currentWorkspaceId"
            @send="handleSend"
            @stop="handleStop"
          />
        </div>
      </div>

      <ChatRightSidebar
        :mode="isSessionRoute ? 'session' : 'workspace'"
        :open="isSidebarOpen"
        :session="currentSession"
        :workspace="currentWorkspace"
        :message-count="messageCount"
        :todos="isSessionRoute ? todos : []"
      />
    </div>
  </div>
</template>
