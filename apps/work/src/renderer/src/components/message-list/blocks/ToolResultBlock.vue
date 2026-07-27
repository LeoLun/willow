<script setup lang="ts">
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@willow/shadcn/components/ui/collapsible";
import { computed, ref } from "vue";
import {
  formatToolCallTitle,
  formatToolCallIcon,
  formatToolDetails,
  formatToolResultTitle,
} from "../tool-display";
import type { Message, ToolCallContent } from "../types";
import ContentBlocks from "./ContentBlocks.vue";
import MarkdownBlock from "./MarkdownBlock.vue";

const props = defineProps<{
  toolCall?: ToolCallContent;
  result?: Message;
}>();

const open = ref(false);
const summary = computed(
  () =>
    (props.toolCall
      ? formatToolCallTitle(props.toolCall.name, props.toolCall.arguments)
      : undefined) ??
    formatToolResultTitle(props.result?.details) ??
    (props.result?.isError
      ? `${props.result.toolName ?? "工具"} 执行失败`
      : `工具结果${props.result?.toolName ? ` · ${props.result.toolName}` : ""}`),
);

const iconComponent = computed(() => {
  return formatToolCallIcon(props.toolCall?.name ?? props.result?.toolName ?? "");
});

console.log("result", props.result);

const formattedDetails = computed(() =>
  props.result?.details === undefined ? undefined : formatToolDetails(props.result.details),
);
</script>

<template>
  <Collapsible v-model:open="open" data-content-type="toolResult" data-slot="tool-result-block">
    <CollapsibleTrigger as-child>
      <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-1.5 text-left text-muted-foreground"
        :aria-label="`${summary}，${open ? '收起' : '展开'}执行结果`"
      >
        <component
          :is="iconComponent"
          class="size-4 shrink-0"
          :class="props.result?.isError ? 'text-destructive' : ''"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1 truncate">{{ summary }}</span>
      </button>
    </CollapsibleTrigger>

    <CollapsibleContent
      class="mt-2 flex max-h-[120px] flex-col gap-2 overflow-y-auto rounded-lg border bg-sidebar-foreground/5 p-3 text-sm text-muted-foreground"
      :class="props.result?.isError ? 'text-destructive' : ''"
    >
      <div v-if="formattedDetails">{{ formattedDetails }}</div>
      <ContentBlocks v-if="props.result" :message="props.result" />
      <p v-else class="text-sm text-muted-foreground">执行中…</p>
    </CollapsibleContent>
  </Collapsible>
</template>
