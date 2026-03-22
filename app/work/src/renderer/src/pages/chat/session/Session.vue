<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";
import { useSessionStore } from "@/stores/session";
import { storeToRefs } from "pinia";
import type { Session } from "@shared/api";

const sessionStore = useSessionStore();
const { sessionMap } = storeToRefs(sessionStore);

const route = useRoute();
const sessionId = computed(() => {
  return Number(route.params.sessionId);
});

const session = computed(() => {
  let _session: Session | undefined;
  Object.keys(sessionMap.value).forEach((workspaceId) => {
    const sessions = sessionMap.value[Number(workspaceId)];
    const session = sessions.find((s) => s.id === sessionId.value);
    if (session) {
      _session = session;
    }
  })
  return _session;
});

</script>

<template>
  <div class="flex flex-col h-full items-center">
    <div class="text-sm">
      {{ session?.title || '未命名会话' }}
    </div>
    <div class="flex-1 w-full overflow-y-auto pt-2 pb-2">
      <div>你是谁？</div>
    </div>
  </div>
</template>