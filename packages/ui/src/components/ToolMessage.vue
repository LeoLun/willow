<script setup lang="ts">
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import { computed } from "vue";
import { renderTool } from "../renderers/registry";

interface ToolApproval {
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  reason: string;
  risk: "medium" | "high";
  status: "pending" | "approved" | "rejected";
}

const props = withDefaults(
  defineProps<{
    toolCall: ToolCall;
    tool?: AgentTool;
    result?: ToolResultMessage;
    pending?: boolean;
    aborted?: boolean;
    isStreaming?: boolean;
    approval?: ToolApproval;
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

const argsSummary = computed(() => {
  const value = props.approval?.arguments ?? props.toolCall.arguments;
  if (!value) return "";

  try {
    if (typeof value === "string") {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed.command === "string") {
        return parsed.command;
      }
      return JSON.stringify(parsed, null, 2);
    }

    if (typeof value === "object" && value !== null && "command" in value) {
      const command = (value as { command?: unknown }).command;
      if (typeof command === "string") {
        return command;
      }
    }

    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
});
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="approval"
      class="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-sm text-foreground"
    >
      <div class="font-medium">
        {{ approval.status === "pending" ? "工具调用等待审批" : "工具审批结果" }}
      </div>
      <div class="mt-1 text-muted-foreground">
        {{ approval.reason }}
      </div>
      <div v-if="argsSummary" class="mt-2 rounded bg-background/60 p-2 font-mono text-xs">
        {{ argsSummary }}
      </div>
      <div
        v-if="approval.toolName === 'bash' && approval.status === 'pending'"
        class="mt-2 text-xs text-amber-600"
      >
        这是高危操作，需要人工确认。
      </div>
      <div v-if="approval.status !== 'pending'" class="mt-3 text-xs text-muted-foreground">
        {{ approval.status === "approved" ? "本次调用已批准" : "本次调用已拒绝" }}
      </div>
    </div>

    <template v-if="renderResult.isCustom">
      <component :is="renderResult.component" v-bind="renderResult.props" />
    </template>
    <div v-else>
      <component :is="renderResult.component" v-bind="renderResult.props" />
    </div>
  </div>
</template>
