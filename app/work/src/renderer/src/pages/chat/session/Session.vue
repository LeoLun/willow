<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed, ref, watch, nextTick } from "vue";
import { useSessionStore } from "@/stores/session";
import { storeToRefs } from "pinia";
import { useAgentMessages } from "@/composables/useAgentMessages";
import MessageListView from "@/components/base/MessageListView.vue";
import StreamingMessage from "@/components/base/StreamingMessage.vue";
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
    const found = sessions.find((s) => s.id === sessionId.value);
    if (found) {
      _session = found;
    }
  });
  return _session;
});

const { state } = useAgentMessages(sessionId);

const scrollArea = ref<HTMLElement>();

watch(
  () => [state.messages.length, state.streamMessage],
  async () => {
    await nextTick();
    if (scrollArea.value) {
      scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
    }
  },
);
</script>

<template>
  <div class="flex flex-col h-full items-center">
    <div class="text-sm">
      {{ session?.title || '未命名会话' }}
    </div>
    <div ref="scrollArea" class="flex-1 w-full overflow-y-auto pt-2 pb-2">
      <div class="max-w-3xl mx-auto px-4">
        <MessageListView
          :messages="state.messages"
          :tools="state.tools"
          :is-streaming="state.isStreaming"
          :pending-tool-calls="state.pendingToolCalls"
        />

        <StreamingMessage
          v-if="state.isStreaming"
          :message="state.streamMessage"
          :is-streaming="state.isStreaming"
          :tools="state.tools"
          :pending-tool-calls="state.pendingToolCalls"
        />
      </div>
    </div>
  </div>
</template>
