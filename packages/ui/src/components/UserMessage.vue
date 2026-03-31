<script setup lang="ts">
import type { UserMessage as UserMessageType } from "@mariozechner/pi-ai";
import { computed } from "vue";
import type { UserMessageWithAttachments } from "../types";
import AttachmentTile from "./AttachmentTile.vue";
import MarkdownBlock from "./MarkdownBlock.vue";

const props = defineProps<{
  message: UserMessageType | UserMessageWithAttachments;
}>();

const content = computed(() => {
  if (typeof props.message.content === "string") {
    return props.message.content;
  }
  return props.message.content.find((c) => c.type === "text")?.text || "";
});

const attachments = computed(() => {
  if (
    props.message.role === "user-with-attachments" &&
    (props.message as UserMessageWithAttachments).attachments
  ) {
    return (props.message as UserMessageWithAttachments).attachments!;
  }
  return [];
});
</script>

<template>
  <div class="mx-4 flex justify-start">
    <div class="user-message-container rounded-lg bg-secondary px-3 py-1.5 text-sm">
      <MarkdownBlock :content="content" />
      <div v-if="attachments.length > 0" class="mt-3 flex flex-wrap gap-2">
        <AttachmentTile
          v-for="attachment in attachments"
          :key="attachment.id"
          :attachment="attachment"
        />
      </div>
    </div>
  </div>
</template>
