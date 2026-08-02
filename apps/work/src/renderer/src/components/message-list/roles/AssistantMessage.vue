<script setup lang="ts">
import ContentBlocks from "../blocks/ContentBlocks.vue";
import MessageToolbar from "../MessageToolbar.vue";
import type { Message } from "../types";

const props = withDefaults(
  defineProps<{
    message: Message;
    showToolbar?: boolean;
  }>(),
  {
    showToolbar: false,
  },
);
</script>

<template>
  <article
    class="flex justify-start"
    data-slot="assistant-message"
    :data-message-role="props.message.role"
    :data-message-status="props.message.status"
  >
    <div class="flex w-full flex-col gap-2 rounded-2xl text-sm text-card-foreground">
      <ContentBlocks :message="props.message" markdown />
      <MessageToolbar v-if="props.showToolbar" :message="props.message" />
    </div>
  </article>
</template>
