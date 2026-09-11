<script setup lang="ts">
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@willow/shadcn/components/ui/collapsible";
import { ChevronDownIcon, WrenchIcon } from "lucide-vue-next";
import { computed, ref } from "vue";
import { formatToolGroupTitle, type ToolGroupEntry } from "../tool-display";
import ToolMessage from "./ToolMessage.vue";

const props = defineProps<{ tools: readonly ToolGroupEntry[] }>();
const open = ref(false);
const title = computed(() => formatToolGroupTitle(props.tools));
const pending = computed(() =>
  props.tools.some((tool) => !tool.result || tool.result.status === "streaming"),
);
const failed = computed(() => props.tools.some((tool) => tool.result?.isError));
</script>

<template>
  <Collapsible v-model:open="open" data-slot="tool-message-group">
    <CollapsibleTrigger as-child>
      <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-1 text-left text-sm text-muted-foreground"
        :title="title"
        :aria-label="`${title}，${open ? '收起' : '展开'}工具调用`"
      >
        <WrenchIcon
          class="size-4 shrink-0"
          :class="failed ? 'text-destructive' : undefined"
          aria-hidden="true"
        />
        <span
          class="min-w-0 truncate"
          :class="pending ? 'shimmer' : undefined"
          data-slot="tool-group-summary"
          >{{ title }}</span
        >
        <ChevronDownIcon
          class="size-4 shrink-0 transition-transform"
          :class="open ? 'rotate-180' : undefined"
          aria-hidden="true"
        />
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent class="mt-2 flex max-h-[320px] flex-col gap-2 overflow-y-auto">
      <ToolMessage
        v-for="tool in props.tools"
        :key="tool.key"
        :tool-call="tool.toolCall"
        :result="tool.result"
      />
    </CollapsibleContent>
  </Collapsible>
</template>
