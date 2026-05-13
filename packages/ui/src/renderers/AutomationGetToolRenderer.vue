<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Wrench } from "lucide-vue-next";
import { computed } from "vue";
import ToolCallCard from "../components/ToolCallCard.vue";
import { i18n } from "../utils/i18n";

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

const automation = computed(() => {
  return props.result?.details?.automation;
});

const summaryText = computed(() => {
  console.log("params", automation.value.title);
  return `查询自动化 ${automation.value?.title}`;
});
</script>

<template>
  <ToolCallCard
    :title="summaryText"
    :can-expand="false"
    :error="state === 'error'"
    :loading="state === 'running' || state === 'pending'"
  >
    <template #icon>
      <Wrench class="size-3.5 shrink-0 text-muted-foreground" />
    </template>
  </ToolCallCard>
</template>
