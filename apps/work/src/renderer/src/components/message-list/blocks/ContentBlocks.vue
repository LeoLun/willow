<script setup lang="ts">
import { computed } from "vue";
import type { ComposerTokenRule } from "@/components/prompt-composer";
import LocalFileCard from "@/components/prompt-composer/LocalFileCard.vue";
import TokenizedText from "@/components/prompt-composer/TokenizedText.vue";
import { getImageSource } from "../message";
import type { Message } from "../types";
import MarkdownBlock from "./MarkdownBlock.vue";
import ThinkingBlock from "./ThinkingBlock.vue";
import ToolCallBlock from "./ToolCallBlock.vue";
import UnknownBlock from "./UnknownBlock.vue";

interface Props {
  message: Message;
  markdown?: boolean;
  tokenRules?: readonly ComposerTokenRule[];
}

const props = withDefaults(defineProps<Props>(), {
  markdown: false,
  tokenRules: () => [],
});

const lastTextIndex = computed(() => {
  for (let index = props.message.content.length - 1; index >= 0; index -= 1) {
    if (props.message.content[index]?.type === "text") return index;
  }
  return -1;
});

function isStreamingMarkdown(index: number): boolean {
  return props.markdown && props.message.status === "streaming" && index === lastTextIndex.value;
}
</script>

<template>
  <template v-for="(content, index) in props.message.content" :key="`${props.message.id}:${index}`">
    <MarkdownBlock
      v-if="content.type === 'text' && props.markdown"
      :content="content.text"
      :streaming="isStreamingMarkdown(index)"
      data-content-type="text"
    />

    <p
      v-else-if="content.type === 'text'"
      class="break-words whitespace-pre-wrap"
      data-content-type="text"
    >
      <TokenizedText
        v-if="props.tokenRules.length > 0"
        :content="content.text"
        :token-rules="props.tokenRules"
      />
      <template v-else>{{ content.text }}</template>
    </p>

    <img
      v-else-if="content.type === 'image'"
      class="max-h-96 max-w-full rounded-lg object-contain"
      :src="getImageSource(content)"
      alt="消息图片"
      data-content-type="image"
    />

    <LocalFileCard
      v-else-if="content.type === 'localFile'"
      :file="content"
      class="mt-2"
      data-content-type="local-file"
    />

    <ThinkingBlock
      v-else-if="content.type === 'thinking'"
      :content="content"
      :status="content.status"
    />

    <ToolCallBlock v-else-if="content.type === 'toolCall'" :content="content" />

    <UnknownBlock v-else :content="content" />
  </template>
</template>
