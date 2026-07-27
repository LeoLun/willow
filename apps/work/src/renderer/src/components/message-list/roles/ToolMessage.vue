<script setup lang="ts">
import ToolResultBlock from "../blocks/ToolResultBlock.vue";
import type { Message, ToolCallContent } from "../types";

const props = defineProps<{
  toolCall?: ToolCallContent;
  result?: Message;
}>();
</script>

<template>
  <article
    class="flex justify-start"
    data-slot="tool-message"
    data-message-role="toolResult"
    :data-message-status="props.result?.status ?? 'streaming'"
  >
    <div class="flex w-full max-w-[100%] flex-col text-sm text-card-foreground">
      <ToolResultBlock :tool-call="props.toolCall" :result="props.result" />
    </div>
  </article>
</template>
