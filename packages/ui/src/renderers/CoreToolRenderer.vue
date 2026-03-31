<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { ChevronRight, Code } from "lucide-vue-next";
import { computed, ref } from "vue";
import CodeBlock from "../components/CodeBlock.vue";
import ToolHeader from "../components/ToolHeader.vue";
import { i18n } from "../utils/i18n";
import { getToolSummary } from "./tool-summary";

const props = defineProps<{
  toolName: string;
  params?: any;
  result?: ToolResultMessage;
  isStreaming?: boolean;
}>();

const isExpanded = ref(false);

const state = computed(() => {
  if (props.result) return props.result.isError ? "error" : "complete";
  return props.isStreaming ? "inprogress" : "complete";
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
      ?.filter((c) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n") || i18n("(no output)");
  let outputLanguage = "text";

  try {
    const parsed = JSON.parse(outputJson);
    outputJson = JSON.stringify(parsed, null, 2);
    outputLanguage = "json";
  } catch {
    // Not JSON
  }

  return { text: outputJson, language: outputLanguage };
});

const headerText = computed(() => i18n("Tool Call"));

const hasInputData = computed(
  () => !!(paramsJson.value && paramsJson.value !== "{}" && paramsJson.value !== "null"),
);

const hasOutputData = computed(() => !!outputData.value);

const hasDetails = computed(() => hasInputData.value || hasOutputData.value);

const isInProgress = computed(() => state.value === "inprogress");

const shouldShowDetails = computed(
  () => hasDetails.value && !isInProgress.value && isExpanded.value,
);

const summaryText = computed(() => {
  return getToolSummary(props.toolName, props.params, props.result?.details, isInProgress.value);
});

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}
</script>

<template>
  <div class="space-y-3">
    <ToolHeader :state="state" :text="summaryText">
      <template #icon>
        <Code class="h-4 w-4" />
      </template>
    </ToolHeader>

    <!-- <div class="text-sm text-foreground">
     {{ summaryText }}
    </div> -->

    <button
      v-if="hasDetails && !isInProgress"
      type="button"
      class="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      @click="toggleExpanded"
    >
      <span class="inline-block transition-transform" :class="{ 'rotate-90': shouldShowDetails }">
        <ChevronRight class="h-3.5 w-3.5" />
      </span>
      {{ shouldShowDetails ? i18n("Hide details") : i18n("Show details") }}
    </button>

    <template v-if="shouldShowDetails">
      <template v-if="result">
        <div v-if="hasInputData">
          <div class="mb-1 text-xs font-medium text-muted-foreground">
            {{ i18n("Input") }}
          </div>
          <CodeBlock :code="paramsJson" language="json" />
        </div>
        <div v-if="hasOutputData">
          <div class="mb-1 text-xs font-medium text-muted-foreground">
            {{ i18n("Output") }}
          </div>
          <CodeBlock :code="outputData!.text" :language="outputData!.language" />
        </div>
      </template>

      <template v-else-if="hasInputData">
        <div>
          <div class="mb-1 text-xs font-medium text-muted-foreground">
            {{ i18n("Input") }}
          </div>
          <CodeBlock :code="paramsJson" language="json" />
        </div>
      </template>
    </template>
  </div>
</template>
