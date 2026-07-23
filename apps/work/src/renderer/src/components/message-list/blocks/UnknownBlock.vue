<script setup lang="ts">
import { formatMessageValue } from "../message";
import type { MessageContent } from "../types";

defineProps<{
  content: Extract<MessageContent, { type: "unknown" }>;
}>();
</script>

<template>
  <div
    class="rounded-lg border border-dashed bg-muted/40 px-3 py-2"
    data-content-type="unknown"
    data-slot="unknown-block"
  >
    <p class="mb-1 text-xs font-medium">未知节点 · {{ content.nodeType }}</p>
    <pre class="overflow-x-auto text-xs break-words whitespace-pre-wrap">{{
      formatMessageValue(content.value)
    }}</pre>
  </div>
</template>
