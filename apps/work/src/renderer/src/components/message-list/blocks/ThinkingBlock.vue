<script setup lang="ts">
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@willow/shadcn/components/ui/collapsible";
import { Atom } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import type { MessageContent, ThinkingStatus } from "../types";
import MarkdownBlock from "./MarkdownBlock.vue";

const BOTTOM_FOLLOW_THRESHOLD = 24;

interface Props {
  content: Extract<MessageContent, { type: "thinking" }>;
  status: ThinkingStatus;
}

const props = defineProps<Props>();
const open = ref(props.status === "streaming");
const contentContainer = shallowRef<HTMLElement>();
const followingOutput = ref(true);
const statusLabel = computed(() => (props.status === "streaming" ? "思考中" : "思考已完成"));
let contentObserver: MutationObserver | undefined;

function scrollToLatestContent(): void {
  const container = contentContainer.value;
  if (!container || !open.value || props.status !== "streaming" || !followingOutput.value) return;
  container.scrollTop = container.scrollHeight;
}

function handleContentScroll(): void {
  const container = contentContainer.value;
  if (!container) return;
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  followingOutput.value = distanceFromBottom <= BOTTOM_FOLLOW_THRESHOLD;
}

watch(
  contentContainer,
  (container) => {
    contentObserver?.disconnect();
    if (!container) return;
    contentObserver = new MutationObserver(scrollToLatestContent);
    contentObserver.observe(container, { childList: true, characterData: true, subtree: true });
    scrollToLatestContent();
  },
  { flush: "post" },
);

watch(
  [() => props.content.thinking, () => props.status, open],
  async () => {
    await nextTick();
    scrollToLatestContent();
  },
  { flush: "post" },
);

watch(
  () => props.status,
  (status, previousStatus) => {
    if (previousStatus === "streaming" && status === "completed") {
      open.value = false;
    }
  },
);

onBeforeUnmount(() => {
  contentObserver?.disconnect();
});
</script>

<template>
  <Collapsible
    v-model:open="open"
    class="text-muted-foreground"
    data-content-type="thinking"
    data-slot="thinking-block"
  >
    <CollapsibleTrigger as-child>
      <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-1 text-left text-sm"
        :aria-label="`${statusLabel}，${open ? '收起' : '展开'}思考内容`"
      >
        <Atom class="size-4 shrink-0" aria-hidden="true" />
        <span>{{ statusLabel }}</span>
      </button>
    </CollapsibleTrigger>

    <CollapsibleContent>
      <div
        ref="contentContainer"
        class="thinking-content mt-2 max-h-[120px] overflow-y-auto overscroll-contain rounded-lg border bg-sidebar-foreground/5 p-3 text-sm"
        data-slot="thinking-content"
        @scroll="handleContentScroll"
      >
        <p v-if="props.content.redacted" class="leading-6 break-words whitespace-pre-wrap">
          思考内容不可用。
        </p>
        <MarkdownBlock
          v-else
          :content="props.content.thinking"
          :streaming="props.status === 'streaming'"
        />
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>

<style scoped>
.thinking-content :deep(.markdown-new-styling) {
  color: inherit;
}
</style>
