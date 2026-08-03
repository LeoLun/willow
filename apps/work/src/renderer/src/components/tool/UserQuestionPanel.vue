<script setup lang="ts">
import type { AskUserAnswers, UserQuestionEventPayload } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import { Checkbox } from "@willow/shadcn/components/ui/checkbox";
import { Input } from "@willow/shadcn/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@willow/shadcn/components/ui/radio-group";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  MessageCircleQuestion,
} from "lucide-vue-next";
import { computed, ref } from "vue";

const props = defineProps<{
  request: UserQuestionEventPayload;
  onSubmit: (answers?: AskUserAnswers) => Promise<void>;
}>();

const selected = ref<Record<string, string[]>>({});
const customAnswers = ref<Record<string, string>>({});
const submitting = ref(false);
const errorMessage = ref("");
const currentQuestionIndex = ref(0);
const customOptionValue = "__willow_custom_answer__";

const currentQuestion = computed(() => props.request.questions[currentQuestionIndex.value]);
const isLastQuestion = computed(
  () => currentQuestionIndex.value === props.request.questions.length - 1,
);

function hasAnswer(question: string): boolean {
  const hasSelection = (selected.value[question]?.length ?? 0) > 0;
  const hasCustom = (customAnswers.value[question]?.trim().length ?? 0) > 0;
  return hasSelection || hasCustom;
}

const canSubmit = computed(() =>
  props.request.questions.every((question) => hasAnswer(question.question)),
);
const canContinue = computed(
  () => currentQuestion.value !== undefined && hasAnswer(currentQuestion.value.question),
);
const currentRadioValue = computed(() => {
  const question = currentQuestion.value;
  if (!question) return "";
  if (hasCustomAnswer(question.question)) return customOptionValue;
  return selected.value[question.question]?.[0] ?? "";
});

function isSelected(question: string, label: string): boolean {
  return selected.value[question]?.includes(label) === true;
}

function hasCustomAnswer(question: string): boolean {
  return (customAnswers.value[question]?.trim().length ?? 0) > 0;
}

function setOptionChecked(label: string, checked: boolean): void {
  const question = currentQuestion.value;
  if (!question) return;
  const current = selected.value[question.question] ?? [];
  selected.value = {
    ...selected.value,
    [question.question]: checked
      ? current.includes(label)
        ? current
        : [...current, label]
      : current.filter((value) => value !== label),
  };
}

function selectSingleOption(value: string): void {
  const question = currentQuestion.value;
  if (!question || value === customOptionValue) return;
  selected.value = { ...selected.value, [question.question]: [value] };
  customAnswers.value = { ...customAnswers.value, [question.question]: "" };
}

function updateCustom(value: string): void {
  const question = currentQuestion.value;
  if (!question) return;
  customAnswers.value = { ...customAnswers.value, [question.question]: value };
  if (value.trim() && !question.multiSelect) {
    selected.value = { ...selected.value, [question.question]: [] };
  }
}

function showPreviousQuestion(): void {
  if (currentQuestionIndex.value > 0) currentQuestionIndex.value -= 1;
}

function showNextQuestion(): void {
  if (currentQuestionIndex.value < props.request.questions.length - 1) {
    currentQuestionIndex.value += 1;
  }
}

async function submit(answers?: AskUserAnswers): Promise<void> {
  if (submitting.value) return;
  submitting.value = true;
  errorMessage.value = "";
  try {
    await props.onSubmit(answers);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "提交回答失败";
  } finally {
    submitting.value = false;
  }
}

function submitAnswers(): void {
  if (!canSubmit.value) return;
  const answers = Object.fromEntries(
    props.request.questions.map((question) => {
      const values = [...(selected.value[question.question] ?? [])];
      const custom = customAnswers.value[question.question]?.trim();
      if (custom) values.push(custom);
      return [question.question, values];
    }),
  );
  void submit(answers);
}

function handlePrimaryAction(): void {
  if (isLastQuestion.value) {
    submitAnswers();
    return;
  }
  if (canContinue.value) showNextQuestion();
}
</script>

<template>
  <section
    class="grid max-h-[min(32rem,calc(100vh-8rem))] gap-3 overflow-y-auto rounded-[1.25rem] border border-border bg-background p-4 shadow-xl"
    data-slot="user-question-panel"
    aria-labelledby="user-question-title"
  >
    <div class="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <div class="flex min-w-0 items-center gap-2">
        <MessageCircleQuestion class="size-4 shrink-0" aria-hidden="true" />
        <h2 id="user-question-title">需要你的确认</h2>
      </div>
      <nav class="flex shrink-0 items-center gap-1" aria-label="问题切换">
        <button
          type="button"
          class="rounded-md p-1 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          aria-label="上一道题目"
          :disabled="submitting || currentQuestionIndex === 0"
          @click="showPreviousQuestion"
        >
          <ChevronLeft class="size-3" aria-hidden="true" />
        </button>
        <span class="min-w-10 text-center tabular-nums">
          {{ currentQuestionIndex + 1 }}/{{ request.questions.length }}
        </span>
        <button
          type="button"
          class="rounded-md p-1 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          aria-label="下一道题目"
          :disabled="submitting || isLastQuestion"
          @click="showNextQuestion"
        >
          <ChevronRight class="size-3" aria-hidden="true" />
        </button>
      </nav>
    </div>

    <div v-if="currentQuestion" class="grid gap-3">
      <fieldset :key="currentQuestion.question" class="grid gap-1">
        <legend class="mb-2 grid gap-1">
          <span class="text-xs font-medium text-muted-foreground">{{
            currentQuestion.header
          }}</span>
          <span class="text-base font-semibold text-foreground">{{
            currentQuestion.question
          }}</span>
        </legend>

        <template v-if="currentQuestion.multiSelect">
          <label
            v-for="(option, optionIndex) in currentQuestion.options"
            :key="option.label"
            :for="`question-${currentQuestionIndex}-option-${optionIndex}`"
            class="flex min-h-14 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 transition-colors"
            :class="
              isSelected(currentQuestion.question, option.label) ? 'bg-muted' : 'hover:bg-muted/60'
            "
          >
            <Checkbox
              :id="`question-${currentQuestionIndex}-option-${optionIndex}`"
              :model-value="isSelected(currentQuestion.question, option.label)"
              :disabled="submitting"
              :aria-label="option.label"
              @update:model-value="setOptionChecked(option.label, $event === true)"
            />
            <span class="grid min-w-0 gap-0.5">
              <span class="text-sm font-medium text-foreground">{{ option.label }}</span>
              <span class="text-xs leading-relaxed text-muted-foreground">{{
                option.description
              }}</span>
            </span>
          </label>

          <div
            class="flex min-h-14 items-center gap-2.5 rounded-xl px-3 py-2 transition-colors"
            :class="hasCustomAnswer(currentQuestion.question) ? 'bg-muted' : 'hover:bg-muted/60'"
          >
            <Checkbox
              :model-value="hasCustomAnswer(currentQuestion.question)"
              class="pointer-events-none"
              tabindex="-1"
              aria-hidden="true"
            />
            <Input
              :model-value="customAnswers[currentQuestion.question] ?? ''"
              class="h-auto border-0 bg-transparent p-0 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
              :disabled="submitting"
              aria-label="其他回答"
              placeholder="输入其他"
              @update:model-value="updateCustom(String($event))"
            />
          </div>
        </template>

        <RadioGroup
          v-else
          :model-value="currentRadioValue"
          class="gap-1"
          :disabled="submitting"
          @update:model-value="selectSingleOption(String($event))"
        >
          <label
            v-for="(option, optionIndex) in currentQuestion.options"
            :key="option.label"
            :for="`question-${currentQuestionIndex}-option-${optionIndex}`"
            class="flex min-h-14 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 transition-colors"
            :class="
              isSelected(currentQuestion.question, option.label) ? 'bg-muted' : 'hover:bg-muted/60'
            "
          >
            <RadioGroupItem
              :id="`question-${currentQuestionIndex}-option-${optionIndex}`"
              :value="option.label"
              :aria-label="option.label"
            />
            <span class="grid min-w-0 gap-0.5">
              <span class="text-sm font-medium text-foreground">{{ option.label }}</span>
              <span class="text-xs leading-relaxed text-muted-foreground">{{
                option.description
              }}</span>
            </span>
          </label>

          <div
            class="flex min-h-14 items-center gap-2.5 rounded-xl px-3 py-2 transition-colors"
            :class="hasCustomAnswer(currentQuestion.question) ? 'bg-muted' : 'hover:bg-muted/60'"
          >
            <RadioGroupItem
              :value="customOptionValue"
              class="pointer-events-none"
              tabindex="-1"
              aria-hidden="true"
            />
            <Input
              :model-value="customAnswers[currentQuestion.question] ?? ''"
              class="h-auto border-0 bg-transparent p-0 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
              :disabled="submitting"
              aria-label="其他回答"
              placeholder="输入其他"
              @update:model-value="updateCustom(String($event))"
            />
          </div>
        </RadioGroup>
      </fieldset>
    </div>

    <div v-if="errorMessage" class="flex items-center gap-2 text-sm text-destructive" role="alert">
      <CircleAlert class="size-4 shrink-0" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
    </div>

    <div class="flex justify-end gap-2">
      <Button type="button" variant="outline" :disabled="submitting" @click="submit(undefined)">
        跳过
      </Button>
      <Button
        type="button"
        :disabled="submitting || (isLastQuestion ? !canSubmit : !canContinue)"
        :aria-busy="submitting || undefined"
        @click="handlePrimaryAction"
      >
        <LoaderCircle v-if="submitting" class="animate-spin" aria-hidden="true" />
        {{ isLastQuestion ? "确认回答" : "下一道" }}
      </Button>
    </div>
  </section>
</template>
