<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { FocusRail, type FocusRailItem } from "@/components/focus-rail";
import type { Message } from "@/components/message-list";
import { useMessageListScroll } from "@/composables/useMessageListScroll";

const RAIL_LEFT_OFFSET = 20;
const AUTO_TRACK_RESTORE_FALLBACK_MS = 2_000;
const MOUNT_WAIT_FRAMES = 600;

const props = withDefaults(
  defineProps<{
    messages: readonly Message[];
    scrollElement?: HTMLElement;
  }>(),
  { scrollElement: undefined },
);

const emit = defineEmits<{
  navigate: [messageId: string];
}>();

const { scrollToTurn } = useMessageListScroll();
const railOffsetLeft = ref(RAIL_LEFT_OFFSET);
const autoTrackSuppressed = ref(false);
let autoTrackRestoreTimer: ReturnType<typeof setTimeout> | undefined;
let selectGeneration = 0;
let offsetResizeObserver: ResizeObserver | undefined;

function messageTargetId(message: Message): string {
  return `user-message-${message.id}`;
}

function messageText(message: Message): string {
  return message.content
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function messageOf(item: FocusRailItem): Message {
  return item.metadata?.message as Message;
}

const userMessages = computed(() => props.messages.filter((message) => message.role === "user"));

const railItems = computed<FocusRailItem[]>(() => {
  const items: FocusRailItem[] = [];

  for (let index = 0; index < props.messages.length; index += 1) {
    const message = props.messages[index];
    if (message.role !== "user") continue;

    const assistantParts: string[] = [];
    for (let turnIndex = index + 1; turnIndex < props.messages.length; turnIndex += 1) {
      const turnMessage = props.messages[turnIndex];
      if (turnMessage.role === "user") break;
      if (turnMessage.role !== "assistant") continue;
      const text = messageText(turnMessage);
      if (text) assistantParts.push(text);
    }

    items.push({
      id: message.id,
      targetId: messageTargetId(message),
      title: messageText(message) || "附件消息",
      summary: assistantParts.join(" ") || "暂无 AI 文字回复",
      level: 3,
      metadata: { message },
    });
  }

  return items;
});

function updateRailOffset(): void {
  const element = props.scrollElement;
  if (!element) return;
  railOffsetLeft.value = element.getBoundingClientRect().left + RAIL_LEFT_OFFSET;
}

function setupOffsetTracking(): void {
  offsetResizeObserver?.disconnect();
  offsetResizeObserver = undefined;
  const element = props.scrollElement;
  if (!element) return;
  updateRailOffset();
  if (typeof ResizeObserver !== "undefined") {
    offsetResizeObserver = new ResizeObserver(updateRailOffset);
    offsetResizeObserver.observe(element);
  }
}

function restoreAutoTrack(): void {
  if (autoTrackRestoreTimer) {
    clearTimeout(autoTrackRestoreTimer);
    autoTrackRestoreTimer = undefined;
  }
  autoTrackSuppressed.value = false;
}

function centerTargetWhenMounted(targetId: string, generation: number): void {
  let frames = 0;
  const frame = (): void => {
    if (generation !== selectGeneration) return;
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    frames += 1;
    if (frames <= MOUNT_WAIT_FRAMES) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function handleRailSelect(item: FocusRailItem): void {
  const message = messageOf(item);
  const userIndex = userMessages.value.findIndex((candidate) => candidate.id === message.id);
  if (userIndex < 0) return;

  selectGeneration += 1;
  const generation = selectGeneration;
  autoTrackSuppressed.value = true;
  if (autoTrackRestoreTimer) clearTimeout(autoTrackRestoreTimer);
  autoTrackRestoreTimer = setTimeout(restoreAutoTrack, AUTO_TRACK_RESTORE_FALLBACK_MS);

  scrollToTurn(userIndex, { align: "center", behavior: "smooth" });

  const targetId = messageTargetId(message);
  const target = document.getElementById(targetId);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    centerTargetWhenMounted(targetId, generation);
  }

  emit("navigate", message.id);
}

watch(() => props.scrollElement, setupOffsetTracking, { immediate: true });

onBeforeUnmount(() => {
  offsetResizeObserver?.disconnect();
  if (autoTrackRestoreTimer) clearTimeout(autoTrackRestoreTimer);
  selectGeneration += 1;
});
</script>

<template>
  <FocusRail
    :items="railItems"
    :offset-left="railOffsetLeft"
    :root="scrollElement"
    :auto-track="!autoTrackSuppressed"
    :scroll-to-target="false"
    @select="handleRailSelect"
  >
    <template #content="{ item }">
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-foreground" :title="item.title">
          {{ item.title }}
        </p>
        <p class="mt-1 line-clamp-3 text-sm leading-5 text-muted-foreground">
          {{ item.summary }}
        </p>
      </div>
    </template>
  </FocusRail>
</template>
