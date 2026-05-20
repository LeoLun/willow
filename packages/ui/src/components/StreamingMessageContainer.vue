<script setup lang="ts">
import type { AgentMessage, AgentTool } from "@mariozechner/pi-agent-core";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { AssistantMessage as AssistantMessageType } from "@mariozechner/pi-ai";
import { ref, watch } from "vue";
import AssistantMessage from "./AssistantMessage.vue";
import StreamLoading from "./StreamLoading.vue";

const props = withDefaults(
  defineProps<{
    message: AgentMessage | null;
    tools?: AgentTool[];
    isStreaming?: boolean;
    pendingToolCalls?: Set<string>;
    toolApprovals?: Map<string, any>;
    toolResultsById?: Map<string, ToolResultMessage>;
    onCostClick?: () => void;
  }>(),
  {
    tools: () => [],
    isStreaming: false,
  },
);

const displayMessage = ref<AgentMessage | null>(null);

watch(
  () => props.message,
  (newMsg) => {
    displayMessage.value = newMsg;
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <template v-if="!displayMessage">
    <div v-if="isStreaming" class="mb-3 flex flex-col gap-3">
      <StreamLoading class="mx-4 inline-block" />
    </div>
  </template>

  <template v-else-if="displayMessage.role === 'assistant'">
    <div class="mb-3 flex flex-col gap-3">
      <AssistantMessage
        :message="displayMessage as AssistantMessageType"
        :tools="tools"
        :is-streaming="isStreaming"
        :pending-tool-calls="pendingToolCalls"
        :tool-approvals="toolApprovals"
        :tool-results-by-id="toolResultsById"
        :hide-tool-calls="false"
        :on-cost-click="onCostClick"
      />
      <StreamLoading v-if="isStreaming" class="mx-4 inline-block" />
    </div>
  </template>
</template>
