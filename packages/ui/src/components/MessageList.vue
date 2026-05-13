<script setup lang="ts">
import type { AgentMessage, AgentTool } from "@mariozechner/pi-agent-core";
import type {
  AssistantMessage as AssistantMessageType,
  ToolResultMessage,
} from "@mariozechner/pi-ai";
import { computed } from "vue";
import { renderMessage } from "../utils/message-renderer";
import AssistantMessage from "./AssistantMessage.vue";
import UserMessage from "./UserMessage.vue";

const props = withDefaults(
  defineProps<{
    messages: AgentMessage[];
    tools?: AgentTool[];
    isStreaming?: boolean;
    pendingToolCalls?: Set<string>;
    toolApprovals?: Map<string, any>;
    onCostClick?: () => void;
  }>(),
  {
    tools: () => [],
    isStreaming: false,
  },
);

interface RenderItem {
  key: string;
  type: "custom" | "user" | "assistant";
  data: any;
}

const renderItems = computed(() => {
  const resultByCallId = new Map<string, ToolResultMessage>();
  for (const message of props.messages) {
    if (message.role === "toolResult") {
      resultByCallId.set((message as ToolResultMessage).toolCallId, message as ToolResultMessage);
    }
  }

  const items: RenderItem[] = [];
  let index = 0;
  for (const msg of props.messages) {
    if (msg.role === "artifact") {
      index++;
      continue;
    }

    const customRender = renderMessage(msg);
    if (customRender) {
      items.push({
        key: `msg:${index}`,
        type: "custom",
        data: customRender,
      });
      index++;
      continue;
    }

    if (msg.role === "user" || msg.role === "user-with-attachments") {
      items.push({
        key: `msg:${index}`,
        type: "user",
        data: msg,
      });
    } else if (msg.role === "assistant") {
      items.push({
        key: `msg:${index}`,
        type: "assistant",
        data: {
          message: msg as AssistantMessageType,
          toolResultsById: resultByCallId,
        },
      });
    }
    index++;
  }
  return items;
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <template v-for="item in renderItems" :key="item.key">
      <component v-if="item.type === 'custom'" :is="item.data.component" v-bind="item.data.props" />
      <UserMessage v-else-if="item.type === 'user'" :message="item.data" />
      <AssistantMessage
        v-else-if="item.type === 'assistant'"
        :message="item.data.message"
        :tools="tools"
        :is-streaming="false"
        :pending-tool-calls="pendingToolCalls"
        :tool-approvals="toolApprovals"
        :tool-results-by-id="item.data.toolResultsById"
        :hide-tool-calls="false"
        :hide-pending-tool-calls="false"
        :on-cost-click="onCostClick"
      />
    </template>
  </div>
</template>
