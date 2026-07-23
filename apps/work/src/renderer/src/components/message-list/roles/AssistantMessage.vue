<script setup lang="ts">
import ContentBlocks from "../blocks/ContentBlocks.vue";
import type { Message } from "../types";

const props = defineProps<{
  message: Message;
}>();
</script>

<template>
  <article
    class="flex justify-start"
    data-slot="assistant-message"
    :data-message-role="props.message.role"
    :data-message-status="props.message.status"
  >
    <div
      class="flex max-w-[100%] flex-col gap-2 rounded-2xl bg-card py-3 text-sm text-card-foreground"
    >
      <ContentBlocks :message="props.message" markdown />
    </div>
  </article>
</template>
