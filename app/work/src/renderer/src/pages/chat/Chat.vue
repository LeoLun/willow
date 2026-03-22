<script setup lang="ts">
import Sender from "@/components/base/sender/index.vue";
import { electronAPI } from "@/lib/ipc";
import type { SendMessage } from "@shared/api";
import { useRoute, useRouter } from "vue-router";
import { useSessionStore } from "@/stores/session";

const sessionStore = useSessionStore();
const route = useRoute();
const router = useRouter();
async function handleSend(request: SendMessage) {
  // 检查是否为 session 路由
  if (route.name === "session") {
    const sessionId = route.params.sessionId;
    electronAPI.sendMessage({
      sessionId: Number(sessionId),
      ...request,
    });
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
  <div class="flex flex-col h-full p-3 items-center">
    <div class="flex-1 w-full overflow-y-auto">
      <RouterView />
    </div>
    <Sender class="w-[80%]" @send="handleSend" />
  </div>
</template>

<style scoped>

</style>