<script setup lang="ts">
import { defaultComposerTokenRules } from "@/components/prompt-composer";
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
      class="flex max-w-[85%] flex-col gap-2 rounded-2xl bg-secondary px-3 py-3 text-sm text-card-foreground"
    >
      <ContentBlocks :message="props.message" :token-rules="defaultComposerTokenRules" />
    </div>
  </article>
</template>
