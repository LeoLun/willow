<script setup lang="ts">
import type { SendMessage } from "@shared/api";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import Sender from "@/components/base/sender/index.vue";
import TodoProgress from "@/components/base/TodoProgress.vue";
import { useAgentMessages } from "@/composables/useAgentMessages";
import { useTodoProgress } from "@/composables/useTodoProgress";
import { electronAPI } from "@/lib/ipc";
import { useSessionStore } from "@/stores/session";

const sessionStore = useSessionStore();
const route = useRoute();
const router = useRouter();
const sessionId = computed(() => {
  const value = Number(route.params.sessionId);
  return Number.isNaN(value) ? 0 : value;
});

const { todos, hasActiveTodos, restoreFromActiveStream } = useTodoProgress(sessionId);
const { state } = useAgentMessages(sessionId, {
  onActiveStreamLoaded: (activeStream) => {
    restoreFromActiveStream(activeStream.todos);
  },
});
const isSessionRoute = computed(() => route.name === "session");

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
</script>

<template>
  <div class="flex h-full flex-col items-center p-3">
    <div class="min-h-0 w-full flex-1">
      <RouterView v-slot="{ Component }">
        <component
          :is="Component"
          :messages="state.messages"
          :stream-message="state.streamMessage"
          :is-streaming="state.isStreaming"
          :tools="state.tools"
          :pending-tool-calls="state.pendingToolCalls"
          :tool-approvals="state.toolApprovals"
          :on-approve-tool-call="(toolCallId: string) => handleToolApproval(toolCallId, 'approved')"
          :on-reject-tool-call="(toolCallId: string) => handleToolApproval(toolCallId, 'rejected')"
        />
      </RouterView>
    </div>
    <div class="relative w-[80%]">
      <div v-if="hasActiveTodos" class="h-[40px]"></div>
      <TodoProgress
        v-if="hasActiveTodos"
        class="absolute bottom-[calc(100%-32px)] w-full"
        :todos="todos"
      />
      <Sender
        :messages="state.messages"
        :stream-message="state.streamMessage"
        :is-streaming="state.isStreaming"
        :show-usage="isSessionRoute"
        @send="handleSend"
        @stop="handleStop"
      />
    </div>
  </div>
</template>

<style scoped></style>
