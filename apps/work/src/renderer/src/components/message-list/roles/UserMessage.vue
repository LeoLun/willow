<script setup lang="ts">
import { computed } from "vue";
import { defaultComposerTokenRules } from "@/components/prompt-composer";
import LocalFileCard from "@/components/prompt-composer/LocalFileCard.vue";
import ContentBlocks from "../blocks/ContentBlocks.vue";
import MessageToolbar from "../MessageToolbar.vue";
import type { Message, MessageContent } from "../types";

const props = withDefaults(
  defineProps<{
    message: Message;
    withAnchorId?: boolean;
  }>(),
  { withAnchorId: true },
);

type AttachmentContent = Extract<MessageContent, { type: "localFile" | "image" }>;
type MergedAttachment = AttachmentContent & { data?: string; mimeType?: string };

const attachments = computed(() => {
  const result: MergedAttachment[] = [];
  const mapByName = new Map<string, MergedAttachment>();
  const mapByPath = new Map<string, MergedAttachment>();

  for (const content of props.message.content) {
    if (content.type === "localFile") {
      const existing =
        (content.name ? mapByName.get(content.name) : undefined) ??
        (content.path ? mapByPath.get(content.path) : undefined);

      if (existing) {
        Object.assign(existing, content);
      } else {
        const item: MergedAttachment = { ...content };
        if (content.name) mapByName.set(content.name, item);
        if (content.path) mapByPath.set(content.path, item);
        result.push(item);
      }
    } else if (content.type === "image") {
      const existing = content.name ? mapByName.get(content.name) : undefined;
      if (existing) {
        existing.data = content.data;
        if (!existing.mimeType) existing.mimeType = content.mimeType;
      } else {
        const item: MergedAttachment = { ...content };
        if (content.name) mapByName.set(content.name, item);
        result.push(item);
      }
    }
  }

  return result;
});

const bodyMessage = computed<Message>(() => ({
  ...props.message,
  content: props.message.content.filter(
    (content) => content.type !== "localFile" && content.type !== "image",
  ),
}));
</script>

<template>
  <article
    class="group/message flex justify-end"
    data-slot="user-message"
    :id="props.withAnchorId ? `user-message-${props.message.id}` : undefined"
    :data-message-role="props.message.role"
    :data-message-status="props.message.status"
  >
    <div class="flex max-w-[100%] flex-col items-end gap-2">
      <div
        v-if="attachments.length > 0"
        class="max-w-full overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-slot="user-message-attachments"
      >
        <div class="flex w-max min-w-full flex-nowrap justify-end gap-1.5">
          <LocalFileCard
            v-for="(file, index) in attachments"
            :key="
              'path' in file && file.path
                ? file.path
                : 'name' in file && file.name
                  ? file.name
                  : `attachment-${index}`
            "
            :file="file"
            compact
          />
        </div>
      </div>
      <div
        v-if="bodyMessage.content.length > 0"
        class="max-w-full rounded-2xl bg-secondary px-3 py-3 text-sm text-card-foreground"
        data-slot="user-message-body"
      >
        <ContentBlocks :message="bodyMessage" :token-rules="defaultComposerTokenRules" />
      </div>
      <MessageToolbar :message="props.message" align="end" show-timestamp :visible="false" />
    </div>
  </article>
</template>
