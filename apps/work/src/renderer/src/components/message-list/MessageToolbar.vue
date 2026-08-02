<script setup lang="ts">
import { CheckIcon, CopyIcon } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref } from "vue";
import { cn } from "@/lib/styles";
import { formatMessageTimestamp, getMessageCopyText } from "./message-toolbar";
import type { Message } from "./types";

const props = withDefaults(
  defineProps<{
    message: Message;
    align?: "start" | "end";
    showTimestamp?: boolean;
    visible?: boolean;
  }>(),
  {
    align: "start",
    showTimestamp: false,
    visible: true,
  },
);

const copyText = computed(() => getMessageCopyText(props.message));
const timestamp = computed(() => formatMessageTimestamp(props.message.timestamp));
const copied = ref(false);
let resetCopiedTimer: ReturnType<typeof setTimeout> | undefined;

async function copyMessage(event: MouseEvent): Promise<void> {
  if (!copyText.value) return;
  const button = event.currentTarget as HTMLButtonElement;
  const triggeredByPointer = event.detail > 0;

  try {
    await navigator.clipboard.writeText(copyText.value);
    if (triggeredByPointer) button.blur();
    copied.value = true;
    if (resetCopiedTimer) clearTimeout(resetCopiedTimer);
    resetCopiedTimer = setTimeout(() => {
      copied.value = false;
      resetCopiedTimer = undefined;
    }, 3_000);
  } catch (error) {
    console.error("复制消息失败:", error);
  }
}

onBeforeUnmount(() => {
  if (resetCopiedTimer) clearTimeout(resetCopiedTimer);
});
</script>

<template>
  <div
    :class="
      cn(
        'flex min-h-7 items-center gap-1 text-muted-foreground transition-opacity',
        props.align === 'end' ? 'justify-end' : 'justify-start',
        !props.visible &&
          'pointer-events-none opacity-0 group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100 group-hover/message:pointer-events-auto group-hover/message:opacity-100',
      )
    "
    role="toolbar"
    aria-label="消息操作"
    data-slot="message-toolbar"
    :data-visibility="props.visible ? 'always' : 'interaction'"
  >
    <time
      v-if="props.showTimestamp"
      class="px-1 text-xs tabular-nums"
      data-slot="message-timestamp"
    >
      {{ timestamp }}
    </time>
    <button
      type="button"
      :class="
        cn(
          'no-drag-region inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
          copied && 'bg-accent text-foreground',
        )
      "
      :disabled="!copyText"
      :aria-label="copied ? '已复制' : '复制消息'"
      :title="copied ? '已复制' : '复制消息'"
      data-slot="message-copy"
      :data-copy-state="copied ? 'copied' : 'idle'"
      @click="copyMessage"
    >
      <CheckIcon v-if="copied" class="size-4" aria-hidden="true" data-icon="check" />
      <CopyIcon v-else class="size-4" aria-hidden="true" data-icon="copy" />
    </button>
  </div>
</template>
