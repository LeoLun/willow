<script setup lang="ts">
import type { AgentMessage, AgentTool } from "@mariozechner/pi-agent-core";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { AssistantMessage as AssistantMessageType } from "@mariozechner/pi-ai";
import { ref, watch } from "vue";
import AssistantMessage from "./AssistantMessage.vue";

const props = withDefaults(
  defineProps<{
    message: AgentMessage | null;
    tools?: AgentTool[];
    isStreaming?: boolean;
    pendingToolCalls?: Set<string>;
    toolResultsById?: Map<string, ToolResultMessage>;
    onCostClick?: () => void;
  }>(),
  {
    tools: () => [],
    isStreaming: false,
  },
);

const displayMessage = ref<AgentMessage | null>(null);
let updateScheduled = false;
let immediateUpdate = false;

watch(
  () => props.message,
  (newMsg) => {
    if (newMsg === null) {
      immediateUpdate = true;
      displayMessage.value = null;
      updateScheduled = false;
      return;
    }

    if (!updateScheduled) {
      updateScheduled = true;
      requestAnimationFrame(() => {
        if (!immediateUpdate && props.message !== null) {
          displayMessage.value = JSON.parse(JSON.stringify(props.message));
        }
        updateScheduled = false;
        immediateUpdate = false;
      });
    }
  },
  { deep: true },
);
</script>

<template>
  <template v-if="!displayMessage">
    <div v-if="isStreaming" class="mb-3 flex flex-col gap-3">
      <span class="mx-4 inline-block h-4 w-2 animate-pulse bg-muted-foreground"></span>
    </div>
  </template>

  <template v-else-if="displayMessage.role === 'assistant'">
    <div class="mb-3 flex flex-col gap-3">
      <AssistantMessage
        :message="displayMessage as AssistantMessageType"
        :tools="tools"
        :is-streaming="isStreaming"
        :pending-tool-calls="pendingToolCalls"
        :tool-results-by-id="toolResultsById"
        :hide-tool-calls="false"
        :on-cost-click="onCostClick"
      />
      <span
        v-if="isStreaming"
        class="mx-4 inline-block h-4 w-2 animate-pulse bg-muted-foreground"
      ></span>
    </div>
  </template>
</template>
