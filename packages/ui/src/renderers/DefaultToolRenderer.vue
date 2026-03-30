<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Code } from "lucide-vue-next";
import { computed } from "vue";
import CodeBlock from "../components/CodeBlock.vue";
import ToolHeader from "../components/ToolHeader.vue";
import { i18n } from "../utils/i18n";

const props = defineProps<{
  params?: any;
  result?: ToolResultMessage;
  isStreaming?: boolean;
}>();

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

const headerText = computed(() => {
  if (
    props.result ||
    (props.params && paramsJson.value && paramsJson.value !== "{}" && paramsJson.value !== "null")
  ) {
    return i18n("Tool Call");
  }
  if (
    props.isStreaming &&
    (!paramsJson.value || paramsJson.value === "{}" || paramsJson.value === "null")
  ) {
    return i18n("Preparing tool parameters...");
  }
  return i18n("Preparing tool...");
});
</script>

<template>
  <div class="space-y-3">
    <ToolHeader :state="state" :text="headerText">
      <template #icon>
        <Code class="h-4 w-4" />
      </template>
    </ToolHeader>

    <template v-if="result">
      <div v-if="paramsJson">
        <div class="mb-1 text-xs font-medium text-muted-foreground">
          {{ i18n("Input") }}
        </div>
        <CodeBlock :code="paramsJson" language="json" />
      </div>
      <div>
        <div class="mb-1 text-xs font-medium text-muted-foreground">
          {{ i18n("Output") }}
        </div>
        <CodeBlock :code="outputData!.text" :language="outputData!.language" />
      </div>
    </template>

    <template v-else-if="params && paramsJson && paramsJson !== '{}' && paramsJson !== 'null'">
      <div>
        <div class="mb-1 text-xs font-medium text-muted-foreground">
          {{ i18n("Input") }}
        </div>
        <CodeBlock :code="paramsJson" language="json" />
      </div>
    </template>
  </div>
</template>
