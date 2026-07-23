<script setup lang="ts">
import { formatMessageValue } from "../message";

defineProps<{
  details: unknown;
}>();
</script>

<template>
  <div
    class="rounded-lg border bg-muted/40 px-3 py-2"
    data-content-type="toolResult-details"
    data-slot="tool-result-block"
  >
    <p class="mb-1 text-xs font-medium">详情</p>
    <pre class="overflow-x-auto text-xs break-words whitespace-pre-wrap">{{
      formatMessageValue(details)
    }}</pre>
  </div>
</template>
