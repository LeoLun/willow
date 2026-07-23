<script setup lang="ts">
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@willow/shadcn/components/ui/collapsible";
import { Atom } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import type { MessageContent, ThinkingStatus } from "../types";

interface Props {
  content: Extract<MessageContent, { type: "thinking" }>;
  status: ThinkingStatus;
}

const props = defineProps<Props>();
const open = ref(props.status === "streaming");
const statusLabel = computed(() => (props.status === "streaming" ? "思考中" : "思考已完成"));

watch(
  () => props.status,
  (status, previousStatus) => {
    if (previousStatus === "streaming" && status === "completed") {
      open.value = false;
    }
  },
);
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
      <p class="mt-3 leading-6 break-words whitespace-pre-wrap">
        {{ props.content.redacted ? "思考内容不可用。" : props.content.thinking }}
      </p>
    </CollapsibleContent>
  </Collapsible>
</template>
