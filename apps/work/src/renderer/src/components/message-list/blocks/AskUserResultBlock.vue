<script setup lang="ts">
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@willow/shadcn/components/ui/collapsible";
import { MessageCircleQuestionIcon } from "lucide-vue-next";
import { computed, ref } from "vue";
import { formatToolCallTitle, getAskUserDetails } from "../tool-display";
import type { Message, ToolCallContent } from "../types";
import ContentBlocks from "./ContentBlocks.vue";

const props = defineProps<{
  toolCall?: ToolCallContent;
  result?: Message;
}>();

const open = ref(false);
const details = computed(() => getAskUserDetails(props.result?.details));
const inputQuestions = computed(() => {
  const args = props.toolCall?.arguments;
  if (typeof args !== "object" || args === null || !("questions" in args)) return [];
  return Array.isArray(args.questions) ? args.questions : [];
});
const questions = computed(() => details.value?.questions ?? inputQuestions.value);
const summary = computed(() =>
  props.toolCall
    ? formatToolCallTitle(props.toolCall.name, props.toolCall.arguments)
    : `询问 ${questions.value.length} 个问题`,
);
</script>

<template>
  <Collapsible
    v-model:open="open"
    data-content-type="toolResult"
    data-tool-name="askUser"
    data-slot="ask-user-result-block"
  >
    <CollapsibleTrigger as-child>
      <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-1.5 text-left text-muted-foreground"
        :aria-label="`${summary}，${open ? '收起' : '展开'}问答详情`"
      >
        <MessageCircleQuestionIcon
          class="size-4 shrink-0"
          :class="props.result?.isError ? 'text-destructive' : ''"
          aria-hidden="true"
        />
        <span
          class="min-w-0 flex-1 truncate"
          :class="props.result ? undefined : 'shimmer'"
          data-slot="tool-summary"
        >
          {{ summary }}
        </span>
      </button>
    </CollapsibleTrigger>

    <CollapsibleContent
      class="mt-2 flex max-h-[220px] flex-col gap-3 overflow-y-auto rounded-lg border bg-sidebar-foreground/5 p-3 text-sm"
    >
      <div v-if="props.result?.isError" class="text-destructive">
        <ContentBlocks :message="props.result" />
      </div>
      <div
        v-for="(question, index) in questions"
        v-else
        :key="String(question.question ?? index)"
        class="grid gap-1"
      >
        <p class="font-medium text-foreground">{{ question.question }}</p>
        <p class="text-muted-foreground" data-slot="ask-user-answer">
          {{
            Array.isArray(question.answers) && question.answers.length > 0
              ? question.answers.join("、")
              : props.result
                ? "未回答"
                : "等待回答…"
          }}
        </p>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
