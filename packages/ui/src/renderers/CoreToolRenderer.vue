<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Braces, Code } from "lucide-vue-next";
import { computed } from "vue";
import CodeBlock from "../components/CodeBlock.vue";
import ToolCallCard from "../components/ToolCallCard.vue";
import ToolCallDetailRow from "../components/ToolCallDetailRow.vue";
import { i18n } from "../utils/i18n";
import { getToolSummary } from "./tool-summary";

const props = defineProps<{
  toolName: string;
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
    getToolSummary(props.toolName, props.params, props.result?.details, isInProgress.value) ||
    props.toolName ||
    i18n("tool_call")
  );
});

const hasInputData = computed(
  () => !!(paramsJson.value && paramsJson.value !== "{}" && paramsJson.value !== "null"),
);
const hasOutputData = computed(() => !!outputData.value);
const hasDetails = computed(() => hasInputData.value || hasOutputData.value);
const canExpand = computed(() => hasDetails.value && !isInProgress.value);
</script>

<template>
  <ToolCallCard
    :title="summaryText"
    :state-label="stateLabel"
    :can-expand="canExpand"
    :error="state === 'error'"
    :loading="state === 'running' || state === 'pending'"
  >
    <template #icon>
      <Code class="size-3.5 shrink-0 text-muted-foreground" />
    </template>

    <template #details>
      <ToolCallDetailRow :icon="Code" text="renderer: core" />
      <ToolCallDetailRow v-if="hasInputData" :icon="Braces" text="JSON 参数详情" />

      <div v-if="hasInputData" class="mt-3 space-y-2">
        <div class="text-xs font-semibold text-muted-foreground">{{ i18n("Input") }}</div>
        <div class="rounded-lg border border-border p-3">
          <CodeBlock :code="paramsJson" language="json" />
        </div>
      </div>
      <div v-if="hasOutputData" class="mt-3 space-y-2">
        <div class="text-xs font-semibold text-muted-foreground">{{ i18n("Output") }}</div>
        <div class="rounded-lg border border-border p-3">
          <CodeBlock :code="outputData!.text" :language="outputData!.language" />
        </div>
      </div>
    </template>
  </ToolCallCard>
</template>
