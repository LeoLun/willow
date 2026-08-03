<script setup lang="ts">
import { computed } from "vue";
import Loading from "@/components/ui/Loading.vue";
import AssistantMessage from "./roles/AssistantMessage.vue";
import ToolMessage from "./roles/ToolMessage.vue";
import UserMessage from "./roles/UserMessage.vue";
import type { Message, MessageContent, ToolCallContent } from "./types";

const props = withDefaults(
  defineProps<{
    messages: readonly Message[];
    streaming?: boolean;
  }>(),
  {
    streaming: false,
  },
);

type MessageItem = {
  type: "message";
  key: string;
  message: Message;
  showToolbar?: boolean;
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

function hasCopyableText(message: Message): boolean {
  return message.content.some((content) => content.type === "text" && content.text.length > 0);
}

function markFinalAssistant(items: DisplayItem[], start: number, end: number): void {
  const item = items[end - 1];
  if (
    end > start &&
    item?.type === "message" &&
    item.message.role === "assistant" &&
    item.message.status === "completed" &&
    hasCopyableText(item.message)
  ) {
    item.showToolbar = true;
  }
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

  let turnStart = 0;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item?.type !== "message" || item.message.role !== "user") continue;

    markFinalAssistant(items, turnStart, index);
    turnStart = index + 1;
  }
  if (!props.streaming) markFinalAssistant(items, turnStart, items.length);

  return items;
});
</script>

<template>
  <div class="flex flex-col gap-2" data-slot="message-list">
    <template v-for="item in displayItems" :key="item.key">
      <ToolMessage v-if="item.type === 'tool'" :tool-call="item.toolCall" :result="item.result" />
      <UserMessage v-else-if="item.message.role === 'user'" :message="item.message" />
      <AssistantMessage v-else :message="item.message" :show-toolbar="item.showToolbar === true" />
    </template>

    <div
      v-if="props.streaming"
      class="flex items-center gap-3 py-0.5 text-muted-foreground"
      role="status"
      aria-label="正在工作中"
      data-slot="message-list-working"
    >
      <Loading class="size-3 shrink-0" aria-hidden="true" />
      <span class="shimmer text-sm" aria-hidden="true" data-slot="message-list-working-label">
        正在工作中
      </span>
    </div>
  </div>
</template>
