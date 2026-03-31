<script setup lang="ts">
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type {
  AssistantMessage as AssistantMessageType,
  ToolResultMessage,
} from "@mariozechner/pi-ai";
import { computed } from "vue";
import { formatUsage } from "../utils/format";
import { i18n } from "../utils/i18n";
import MarkdownBlock from "./MarkdownBlock.vue";
import ThinkingBlock from "./ThinkingBlock.vue";
import ToolMessage from "./ToolMessage.vue";

const props = withDefaults(
  defineProps<{
    message: AssistantMessageType;
    tools?: AgentTool[];
    pendingToolCalls?: Set<string>;
    hideToolCalls?: boolean;
    toolResultsById?: Map<string, ToolResultMessage>;
    isStreaming?: boolean;
    hidePendingToolCalls?: boolean;
    onCostClick?: () => void;
  }>(),
  {
    tools: () => [],
    hideToolCalls: false,
    isStreaming: false,
    hidePendingToolCalls: false,
  },
);

const orderedParts = computed(() => {
  const parts: Array<{
    type: "text" | "thinking" | "toolCall";
    key: string;
    data: any;
  }> = [];

  let idx = 0;
  for (const chunk of props.message.content) {
    if (chunk.type === "text" && chunk.text.trim() !== "") {
      parts.push({ type: "text", key: `text-${idx}`, data: chunk.text });
    } else if (chunk.type === "thinking" && chunk.thinking.trim() !== "") {
      parts.push({
        type: "thinking",
        key: `thinking-${idx}`,
        data: chunk.thinking,
      });
    } else if (chunk.type === "toolCall") {
      if (!props.hideToolCalls) {
        const pending = props.pendingToolCalls?.has(chunk.id) ?? false;
        const result = props.toolResultsById?.get(chunk.id);
        if (props.hidePendingToolCalls && pending && !result) {
          idx++;
          continue;
        }
        const tool = props.tools?.find((t) => t.name === chunk.name);
        const aborted = props.message.stopReason === "aborted" && !result;
        parts.push({
          type: "toolCall",
          key: `tool-${idx}`,
          data: { chunk, tool, result, pending, aborted },
        });
      }
    }
    idx++;
  }
  return parts;
});

const usageText = computed(() => {
  if (!props.message.usage || props.isStreaming) return "";
  return formatUsage(props.message.usage);
});
</script>

<template>
  <div>
    <div v-if="orderedParts.length" class="flex flex-col gap-3 px-4">
      <template v-for="part in orderedParts" :key="part.key">
        <MarkdownBlock v-if="part.type === 'text'" :content="part.data" />
        <ThinkingBlock
          v-else-if="part.type === 'thinking'"
          :content="part.data"
          :is-streaming="isStreaming"
        />
        <ToolMessage
          v-else-if="part.type === 'toolCall'"
          :tool="part.data.tool"
          :tool-call="part.data.chunk"
          :result="part.data.result"
          :pending="part.data.pending"
          :aborted="part.data.aborted"
          :is-streaming="isStreaming"
        />
      </template>
    </div>

    <div
      v-if="usageText"
      class="mt-2 px-4 text-xs text-muted-foreground transition-colors"
      :class="{ 'cursor-pointer hover:text-foreground': onCostClick }"
      @click="onCostClick?.()"
    >
      {{ usageText }}
    </div>

    <div
      v-if="message.stopReason === 'error' && message.errorMessage"
      class="mx-4 mt-3 overflow-hidden rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
    >
      <strong>{{ i18n("Error:") }}</strong> {{ message.errorMessage }}
    </div>

    <span v-if="message.stopReason === 'aborted'" class="text-sm text-destructive italic">
      {{ i18n("request_aborted") }}
    </span>
  </div>
</template>
