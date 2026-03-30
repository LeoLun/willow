<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { SquareTerminal } from "lucide-vue-next";
import { computed } from "vue";
import ConsoleBlock from "../components/ConsoleBlock.vue";
import ToolHeader from "../components/ToolHeader.vue";
import { i18n } from "../utils/i18n";

const props = defineProps<{
  params?: { command?: string };
  result?: ToolResultMessage;
  isStreaming?: boolean;
}>();

const state = computed(() => {
  if (props.result) return props.result.isError ? "error" : "complete";
  return "inprogress";
});

const headerText = computed(() => {
  if (!props.params?.command) return i18n("Waiting for command...");
  return i18n("Running command...");
});

const consoleContent = computed(() => {
  if (props.result && props.params?.command) {
    const output =
      props.result.content
        ?.filter((c) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n") || "";
    return output ? `> ${props.params.command}\n\n${output}` : `> ${props.params.command}`;
  }
  if (props.params?.command) {
    return `> ${props.params.command}`;
  }
  return "";
});
</script>

<template>
  <div class="space-y-3">
    <ToolHeader :state="state" :text="headerText">
      <template #icon>
        <SquareTerminal class="h-4 w-4" />
      </template>
    </ToolHeader>

    <ConsoleBlock
      v-if="consoleContent"
      :content="consoleContent"
      :variant="result?.isError ? 'error' : 'default'"
    />
  </div>
</template>
