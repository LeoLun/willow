<script setup lang="ts">
import type { SendMessage } from "@shared/api";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import Sender from "@/components/base/sender/index.vue";
import { useAgentMessages } from "@/composables/useAgentMessages";
import { electronAPI } from "@/lib/ipc";
import { useSessionStore } from "@/stores/session";

const sessionStore = useSessionStore();
const route = useRoute();
const router = useRouter();
const sessionId = computed(() => {
  const value = Number(route.params.sessionId);
  return Number.isNaN(value) ? 0 : value;
});
const { state } = useAgentMessages(sessionId);
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
        />
      </RouterView>
    </div>
    <Sender
      class="w-[80%]"
      :messages="state.messages"
      :stream-message="state.streamMessage"
      :is-streaming="state.isStreaming"
      :show-usage="isSessionRoute"
      @send="handleSend"
    />
  </div>
</template>

<style scoped></style>
