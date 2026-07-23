<script setup lang="ts">
import ContentBlocks from "../blocks/ContentBlocks.vue";
import type { Message } from "../types";

const props = defineProps<{
  message: Message;
}>();
</script>

<template>
  <article
    class="flex justify-end"
    data-slot="user-message"
    :data-message-role="props.message.role"
    :data-message-status="props.message.status"
  >
    <div
      class="flex max-w-[85%] flex-col gap-2 rounded-2xl bg-primary px-3 py-3 text-sm text-primary-foreground"
    >
      <ContentBlocks :message="props.message" />
    </div>
  </article>
</template>
