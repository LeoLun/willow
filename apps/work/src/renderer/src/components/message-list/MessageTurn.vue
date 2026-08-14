<script setup lang="ts">
import { computed } from "vue";
import AssistantMessage from "./roles/AssistantMessage.vue";
import ToolMessage from "./roles/ToolMessage.vue";
import UserMessage from "./roles/UserMessage.vue";
import type { Message, MessageContent, ToolCallContent } from "./types";

const props = withDefaults(
  defineProps<{
    messages: readonly Message[];
    streaming?: boolean;
  }>(),
  { streaming: false },
);

type MessageItem = {
  type: "message";
  key: string;
  message: Message;
  showToolbar?: boolean;
};
type ToolItem = { type: "tool"; key: string; toolCall?: ToolCallContent; result?: Message };
type DisplayItem = MessageItem | ToolItem;

function withContent(message: Message, content: MessageContent[], id: string): Message {
  return { ...message, id, content };
}

function hasTurnFooter(message: Message): boolean {
  return (
    message.artifact !== undefined ||
    message.content.some((content) => content.type === "text" && content.text.length > 0)
  );
}

const displayItems = computed<DisplayItem[]>(() => {
  const items: DisplayItem[] = [];
  const pendingTools = new Map<string, ToolItem>();

  for (const message of props.messages) {
    if (message.role === "toolResult") {
      const toolItem = message.toolCallId ? pendingTools.get(message.toolCallId) : undefined;
      if (toolItem && toolItem.result === undefined) toolItem.result = message;
      else items.push({ type: "tool", key: `tool-result:${message.id}`, result: message });
      continue;
    }

    if (message.role !== "assistant" || !message.content.some((item) => item.type === "toolCall")) {
      const item: MessageItem = { type: "message", key: message.id, message };
      items.push(item);
      continue;
    }

    let segment: MessageContent[] = [];
    let segmentIndex = 0;
    const flushSegment = () => {
      if (segment.length === 0) return;
      const id = segmentIndex === 0 ? message.id : `${message.id}:segment:${segmentIndex}`;
      const item: MessageItem = {
        type: "message",
        key: id,
        message: withContent(message, segment, id),
      };
      items.push(item);
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

  const lastItem = items.at(-1);
  if (
    !props.streaming &&
    lastItem?.type === "message" &&
    lastItem.message.role === "assistant" &&
    lastItem.message.status === "completed" &&
    hasTurnFooter(lastItem.message)
  ) {
    lastItem.showToolbar = true;
  }
  return items;
});
</script>

<template>
  <div class="flex flex-col gap-2" data-slot="message-turn">
    <template v-for="item in displayItems" :key="item.key">
      <ToolMessage v-if="item.type === 'tool'" :tool-call="item.toolCall" :result="item.result" />
      <UserMessage v-else-if="item.message.role === 'user'" :message="item.message" />
      <AssistantMessage v-else :message="item.message" :show-toolbar="item.showToolbar === true" />
    </template>
  </div>
</template>
