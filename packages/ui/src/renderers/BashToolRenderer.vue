<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { SquareTerminal } from "lucide-vue-next";
import { computed } from "vue";
import ConsoleBlock from "../components/ConsoleBlock.vue";
import ToolCallCard from "../components/ToolCallCard.vue";
import { i18n } from "../utils/i18n";

const props = defineProps<{
  params?: { command?: string } | string;
  result?: ToolResultMessage;
  isStreaming?: boolean;
}>();

const parsedParams = computed<Record<string, unknown>>(() => {
  if (!props.params) return {};
  if (typeof props.params === "object") return props.params;
  try {
    const parsed = JSON.parse(props.params);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
});

const commandText = computed(() => {
  const command = parsedParams.value.command;
  return typeof command === "string" ? command : "";
});

const state = computed(() => {
  if (props.result) return props.result.isError ? "error" : "completed";
  return props.isStreaming ? "running" : "pending";
});

const titleText = computed(() => {
  if (!commandText.value) return i18n("waiting_for_command");
  return `运行 Bash 命令`;
});

const outputText = computed(() => {
  return (
    props.result?.content
      ?.filter((item) => item.type === "text")
      .map((item: any) => item.text)
      .join("\n") ?? ""
  );
});

const consoleContent = computed(() => {
  if (!commandText.value && !outputText.value) return "";
  if (!commandText.value) return outputText.value;
  return outputText.value
    ? `> ${commandText.value}\n\n${outputText.value}`
    : `> ${commandText.value}`;
});

const canExpand = computed(() => Boolean(commandText.value || outputText.value || props.result));
</script>

<template>
  <ToolCallCard
    :title="titleText"
    :can-expand="canExpand"
    :error="state === 'error'"
    :loading="state === 'running' || state === 'pending'"
  >
    <template #icon>
      <SquareTerminal class="size-3.5 shrink-0 text-muted-foreground" />
    </template>

    <template #details>
      <ConsoleBlock
        v-if="consoleContent"
        class="mt-3"
        :content="consoleContent"
        :variant="result?.isError ? 'error' : 'default'"
      />
    </template>
  </ToolCallCard>
</template>
