<script setup lang="ts">
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@willow/shadcn/components/ui/collapsible";
import { ChevronRightIcon } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import AssistantMessage from "./roles/AssistantMessage.vue";
import ToolMessage from "./roles/ToolMessage.vue";
import ToolMessageGroup from "./roles/ToolMessageGroup.vue";
import UserMessage from "./roles/UserMessage.vue";
import { formatTurnDuration } from "./turn-duration";
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
type ToolGroupItem = { type: "tool-group"; key: string; tools: ToolItem[] };
type DisplayItem = MessageItem | ToolItem | ToolGroupItem;

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
  const grouped: DisplayItem[] = [];
  for (const item of items) {
    const previous = grouped.at(-1);
    if (item.type === "tool" && previous?.type === "tool") {
      grouped[grouped.length - 1] = {
        type: "tool-group",
        key: previous.key,
        tools: [previous, item],
      };
    } else if (item.type === "tool" && previous?.type === "tool-group") {
      previous.tools.push(item);
    } else {
      grouped.push(item);
    }
  }
  return grouped;
});
const open = ref(false);
watch(
  () => props.streaming,
  () => {
    open.value = false;
  },
);
const duration = computed(() => formatTurnDuration(props.messages));
const completed = computed(() => {
  const users: MessageItem[] = [];
  const process: DisplayItem[] = [];
  const visible: MessageItem[] = [];
  const finalItem = displayItems.value.findLast(
    (item) =>
      item.type === "message" &&
      item.message.role === "assistant" &&
      item.message.content.some((content) => content.type === "text" && content.text.trim()),
  );
  for (const item of displayItems.value) {
    if (item.type !== "message") {
      process.push(item);
      continue;
    }
    if (item.message.role === "user") {
      users.push(item);
      continue;
    }
    const isFinal = item === finalItem;
    const content = isFinal
      ? item.message.content.filter((content) => content.type !== "thinking")
      : [];
    const hidden = isFinal
      ? item.message.content.filter((content) => content.type === "thinking")
      : item.message.content;
    if (hidden.length > 0) {
      process.push({
        ...item,
        key: `${item.key}:process`,
        message: {
          ...item.message,
          content: hidden,
          stopReason: undefined,
          errorMessage: undefined,
          artifact: undefined,
        },
        showToolbar: false,
      });
    }
    if (isFinal || item.showToolbar) {
      visible.push({
        ...item,
        message: { ...item.message, content, stopReason: undefined, errorMessage: undefined },
      });
    }
  }
  // Read failures from original messages: tool-only messages may have no text segment,
  // and messages split around tools must not repeat the same alert.
  for (const message of props.messages) {
    if (message.role === "assistant" && message.stopReason === "error") {
      visible.push({
        type: "message",
        key: `${message.id}:error`,
        message: { ...message, content: [], artifact: undefined },
      });
    }
  }
  return { users, process, visible };
});
</script>

<template>
  <div class="flex flex-col gap-2" data-slot="message-turn">
    <template v-for="item in props.streaming ? displayItems : completed.users" :key="item.key">
      <ToolMessageGroup v-if="item.type === 'tool-group'" :tools="item.tools" />
      <ToolMessage
        v-else-if="item.type === 'tool'"
        :tool-call="item.toolCall"
        :result="item.result"
      />
      <UserMessage v-else-if="item.message.role === 'user'" :message="item.message" />
      <AssistantMessage v-else :message="item.message" :show-toolbar="item.showToolbar === true" />
    </template>
    <template v-if="!props.streaming">
      <Collapsible v-if="completed.process.length" v-model:open="open" data-slot="turn-process">
        <CollapsibleTrigger as-child>
          <button
            type="button"
            class="flex w-full cursor-pointer items-center gap-1 border-b pb-2 text-left text-sm text-muted-foreground"
            :aria-label="`${duration}，${open ? '收起' : '展开'}过程`"
            data-slot="turn-process-trigger"
          >
            <span>{{ duration }}</span>
            <ChevronRightIcon
              class="size-4 transition-transform"
              :class="open ? 'rotate-90' : undefined"
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent class="mt-2 flex flex-col gap-2">
          <template v-for="item in completed.process" :key="item.key">
            <ToolMessageGroup v-if="item.type === 'tool-group'" :tools="item.tools" />
            <ToolMessage
              v-else-if="item.type === 'tool'"
              :tool-call="item.toolCall"
              :result="item.result"
            />
            <AssistantMessage v-else :message="item.message" />
          </template>
        </CollapsibleContent>
      </Collapsible>
      <AssistantMessage
        v-for="item in completed.visible"
        :key="item.key"
        :message="item.message"
        :show-toolbar="item.showToolbar === true"
      />
    </template>
  </div>
</template>
