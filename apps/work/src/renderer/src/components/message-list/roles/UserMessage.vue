<script setup lang="ts">
import { defaultComposerTokenRules } from "@/components/prompt-composer";
import ContentBlocks from "../blocks/ContentBlocks.vue";
import MessageToolbar from "../MessageToolbar.vue";
import type { Message } from "../types";

const props = defineProps<{
  message: Message;
}>();
</script>

<template>
  <article
    class="group/message flex justify-end"
    data-slot="user-message"
    :data-message-role="props.message.role"
    :data-message-status="props.message.status"
  >
    <div class="flex max-w-[85%] flex-col items-end gap-1">
      <div class="max-w-full rounded-2xl bg-secondary px-3 py-3 text-sm text-card-foreground">
        <ContentBlocks :message="props.message" :token-rules="defaultComposerTokenRules" />
      </div>
      <MessageToolbar :message="props.message" align="end" show-timestamp :visible="false" />
    </div>
  </article>
</template>
