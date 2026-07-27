<script setup lang="ts">
import { computed } from "vue";
import AssistantMessage from "./roles/AssistantMessage.vue";
import ToolMessage from "./roles/ToolMessage.vue";
import UserMessage from "./roles/UserMessage.vue";
import type { Message, MessageContent, ToolCallContent } from "./types";

const props = defineProps<{
  messages: readonly Message[];
}>();

type MessageItem = {
  type: "message";
  key: string;
  message: Message;
};

type ToolItem = {
  type: "tool";
  key: string;
  toolCall?: ToolCallContent;
  result?: Message;
};

type DisplayItem = MessageItem | ToolItem;

function withContent(message: Message, content: MessageContent[], id: string): Message {
  return {
    ...message,
    id,
    content,
  };
}

const displayItems = computed<DisplayItem[]>(() => {
  const items: DisplayItem[] = [];
  const pendingTools = new Map<string, ToolItem>();

  for (const message of props.messages) {
    if (message.role === "toolResult") {
      const toolItem = message.toolCallId ? pendingTools.get(message.toolCallId) : undefined;
      if (toolItem && toolItem.result === undefined) {
        toolItem.result = message;
      } else {
        items.push({
          type: "tool",
          key: `tool-result:${message.id}`,
          result: message,
        });
      }
      continue;
    }

    if (
      message.role !== "assistant" ||
      !message.content.some((content) => content.type === "toolCall")
    ) {
      items.push({ type: "message", key: message.id, message });
      continue;
    }

    let segment: MessageContent[] = [];
    let segmentIndex = 0;
    const flushSegment = () => {
      if (segment.length === 0) return;
      const id = segmentIndex === 0 ? message.id : `${message.id}:segment:${segmentIndex}`;
      items.push({
        type: "message",
        key: id,
        message: withContent(message, segment, id),
      });
      segment = [];
      segmentIndex += 1;
    };

    for (const content of message.content) {
      if (content.type !== "toolCall") {
        segment.push(content);
        continue;
      }

      flushSegment();
      const toolItem: ToolItem = {
        type: "tool",
        key: `tool-call:${content.id}`,
        toolCall: content,
      };
      items.push(toolItem);
      pendingTools.set(content.id, toolItem);
    }
    flushSegment();
  }

  return items;
});
</script>

<template>
  <div class="flex flex-col gap-2" data-slot="message-list">
    <template v-for="item in displayItems" :key="item.key">
      <ToolMessage v-if="item.type === 'tool'" :tool-call="item.toolCall" :result="item.result" />
      <UserMessage v-else-if="item.message.role === 'user'" :message="item.message" />
      <AssistantMessage v-else :message="item.message" />
    </template>
  </div>
</template>
