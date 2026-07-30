<script setup lang="ts">
import { formatMessageValue } from "../message";
import { formatToolCallTitle } from "../tool-display";
import type { MessageContent } from "../types";

defineProps<{
  content: Extract<MessageContent, { type: "toolCall" }>;
}>();
</script>

<template>
  <div
    class="rounded-lg border bg-muted/40 px-3 py-2"
    data-content-type="toolCall"
    data-slot="tool-call-block"
  >
    <p class="mb-1 text-xs font-medium">
      {{ formatToolCallTitle(content.name, content.arguments) }}
    </p>
    <pre class="overflow-x-auto text-xs break-words whitespace-pre-wrap">{{
      formatMessageValue(content.arguments)
    }}</pre>
  </div>
</template>
