<script setup lang="ts">
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import { computed } from "vue";
import { renderTool } from "../renderers/registry";

const props = withDefaults(
  defineProps<{
    toolCall: ToolCall;
    tool?: AgentTool;
    result?: ToolResultMessage;
    pending?: boolean;
    aborted?: boolean;
    isStreaming?: boolean;
  }>(),
  {
    pending: false,
    aborted: false,
    isStreaming: false,
  },
);

const toolName = computed(() => props.tool?.name || props.toolCall.name);

const renderResult = computed(() => {
  const result: ToolResultMessage | undefined = props.aborted
    ? {
        role: "toolResult",
        isError: true,
        content: [],
        toolCallId: props.toolCall.id,
        toolName: props.toolCall.name,
        timestamp: Date.now(),
      }
    : props.result;

  return renderTool(
    toolName.value,
    props.toolCall.arguments,
    result,
    !props.aborted && (props.isStreaming || props.pending),
  );
});
</script>

<template>
  <template v-if="renderResult.isCustom">
    <component :is="renderResult.component" v-bind="renderResult.props" />
  </template>
  <div v-else>
    <component :is="renderResult.component" v-bind="renderResult.props" />
  </div>
</template>
