<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { FileText, Wrench } from "lucide-vue-next";
import { computed } from "vue";
import CodeBlock from "../components/CodeBlock.vue";
import ToolCallCard from "../components/ToolCallCard.vue";
import ToolCallDetailRow from "../components/ToolCallDetailRow.vue";
import { i18n } from "../utils/i18n";
import { getToolSummary } from "./tool-summary";

const props = defineProps<{
  toolName?: string;
  params?: any;
  result?: ToolResultMessage;
  isStreaming?: boolean;
}>();

const state = computed(() => {
  if (props.result) return props.result.isError ? "error" : "completed";
  return props.isStreaming ? "running" : "pending";
});

const stateLabel = computed(() => {
  if (state.value === "error") return i18n("Error");
  if (state.value === "running") return i18n("Running");
  if (state.value === "pending") return i18n("Pending");
  return i18n("Completed");
});

const paramsJson = computed(() => {
  if (!props.params) return "";
  try {
    return JSON.stringify(JSON.parse(props.params), null, 2);
  } catch {
    try {
      return JSON.stringify(props.params, null, 2);
    } catch {
      return String(props.params);
    }
  }
});

const outputData = computed(() => {
  if (!props.result) return null;
  let outputJson =
    props.result.content
      ?.filter((item) => item.type === "text")
      .map((item: any) => item.text)
      .join("\n") || i18n("no_output");
  let outputLanguage = "text";

  try {
    const parsed = JSON.parse(outputJson);
    outputJson = JSON.stringify(parsed, null, 2);
    outputLanguage = "json";
  } catch {
    // Keep plain text output as-is.
  }

  return { text: outputJson, language: outputLanguage };
});

const isInProgress = computed(() => state.value === "running");
const summaryText = computed(() => {
  return (
    getToolSummary(
      props.toolName || props.result?.toolName,
      props.params,
      props.result?.details,
      isInProgress.value,
    ) ||
    props.toolName ||
    props.result?.toolName ||
    "渲染未知工具"
  );
});

const hasInputData = computed(
  () => !!(paramsJson.value && paramsJson.value !== "{}" && paramsJson.value !== "null"),
);
const hasOutputData = computed(() => !!outputData.value);
const hasDetails = computed(() => hasInputData.value || hasOutputData.value);
</script>

<template>
  <ToolCallCard
    :title="summaryText"
    :state-label="stateLabel"
    :can-expand="false"
    :error="state === 'error'"
    :loading="state === 'running' || state === 'pending'"
  >
    <template #icon>
      <Wrench class="size-3.5 shrink-0 text-muted-foreground" />
    </template>
  </ToolCallCard>
</template>
