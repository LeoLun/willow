<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { ArrowUpRight, Bot, Clock3 } from "lucide-vue-next";
import { computed } from "vue";

interface AutomationTrigger {
  cronExpression: string;
  timezone?: string;
}

interface AutomationItem {
  title?: string;
  prompt?: string;
  trigger?: AutomationTrigger;
}

interface AutomationCreateResultDetails {
  automation?: AutomationItem;
}

const props = defineProps<{
  params?: unknown;
  result?: ToolResultMessage<AutomationCreateResultDetails>;
  isStreaming?: boolean;
  onOpen?: () => void | Promise<void>;
}>();

const automation = computed(() => props.result?.details?.automation);

const promptPreview = computed(() => {
  const text = automation.value?.prompt?.trim() ?? "";
  if (!text) {
    return "自动化内容已创建。";
  }
  return text;
});

const scheduleLabel = computed(() => {
  const trigger = automation.value?.trigger;
  if (!trigger) {
    return "正在设置自动化";
  }

  return formatAutomationSchedule(trigger.cronExpression, trigger.timezone);
});

const isCompleted = computed(() => Boolean(automation.value) && !props.result?.isError);

async function openAutomationPage() {
  await props.onOpen?.();
}

function formatAutomationSchedule(cronExpression: string, timezone?: string) {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return timezone ? `${cronExpression} · ${timezone}` : cronExpression;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (minute === "0" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "每小时整点";
  }

  if (
    /^\d+$/.test(minute) &&
    /^\d+$/.test(hour) &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return `每天 ${formatTime(hour, minute)}`;
  }

  if (
    /^\d+$/.test(minute) &&
    /^\d+$/.test(hour) &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek !== "*"
  ) {
    const weekLabel = dayOfWeek
      .split(",")
      .map((value) => weekdayLabel(value))
      .filter(Boolean)
      .join("、");
    if (weekLabel) {
      return `每周${weekLabel} ${formatTime(hour, minute)}`;
    }
  }

  return timezone ? `${cronExpression} · ${timezone}` : cronExpression;
}

function formatTime(hour: string, minute: string) {
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function weekdayLabel(value: string) {
  const mapping: Record<string, string> = {
    "0": "日",
    "1": "一",
    "2": "二",
    "3": "三",
    "4": "四",
    "5": "五",
    "6": "六",
    "7": "日",
  };

  return mapping[value] ?? "";
}
</script>

<template>
  <div class="rounded-lg border border-border bg-card px-3 py-1.5 text-card-foreground">
    <div v-if="isCompleted" class="flex items-center justify-between gap-4">
      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Clock3 class="size-4 shrink-0" />
          <span>{{ scheduleLabel }}</span>
        </div>
        <div class="text-base leading-tight font-semibold tracking-tight">
          {{ automation?.title }}
          <span class="text-sm font-normal text-muted-foreground">
            {{ promptPreview }}
          </span>
        </div>
      </div>

      <button
        type="button"
        class="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-5 py-2 text-sm transition-colors hover:bg-muted"
        @click="openAutomationPage"
      >
        打开
        <ArrowUpRight class="size-4" />
      </button>
    </div>

    <div v-else class="flex items-center gap-3 text-sm text-muted-foreground">
      <div
        class="flex size-9 items-center justify-center rounded-full border border-border/70 bg-muted/40"
      >
        <Bot class="size-4" />
      </div>
      <span>{{ props.isStreaming ? "正在创建自动化…" : "自动化创建结果暂不可用" }}</span>
    </div>
  </div>
</template>
