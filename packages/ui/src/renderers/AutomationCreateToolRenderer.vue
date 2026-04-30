<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Button, Card, CardContent, CardTitle, CardDescription } from "@willow/shadcn";
import { CalendarClock, Clock3 } from "lucide-vue-next";
import { computed } from "vue";
import ToolCallCard from "../components/ToolCallCard.vue";
import { i18n } from "../utils/i18n";

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
  onOpenAutomation?: (automation: any) => void | Promise<void>;
}>();

const parsedParams = computed<Record<string, unknown>>(() => {
  if (!props.params) return {};
  if (typeof props.params === "object") return props.params as Record<string, unknown>;
  if (typeof props.params === "string") {
    try {
      const parsed = JSON.parse(props.params);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
});

const automation = computed(() => props.result?.details?.automation);

const state = computed(() => {
  if (props.result) return props.result.isError ? "error" : "completed";
  return props.isStreaming ? "running" : "pending";
});

const stateLabel = computed(() => {
  if (state.value === "error") return i18n("Error");
  if (state.value === "running") return i18n("Running");
  if (state.value === "pending") return i18n("Pending");
  return i18n("Completed");
});

const automationTitle = computed(() => {
  const fromResult = automation.value?.title?.trim();
  if (fromResult) return fromResult;
  const fromParams = parsedParams.value.title;
  return typeof fromParams === "string" && fromParams.trim() ? fromParams.trim() : "自动化任务";
});

const titleText = computed(() => `创建「${automationTitle.value}」任务`);

const promptPreview = computed(() => {
  const text = automation.value?.prompt?.trim();
  if (text) return text;
  const fromParams = parsedParams.value.prompt;
  return typeof fromParams === "string" && fromParams.trim() ? fromParams.trim() : "";
});

const scheduleLabel = computed(() => {
  const trigger = automation.value?.trigger;
  if (trigger) {
    return formatAutomationSchedule(trigger.cronExpression, trigger.timezone);
  }

  const cronExpression = parsedParams.value.cronExpression;
  if (typeof cronExpression === "string" && cronExpression.trim()) {
    return formatAutomationSchedule(cronExpression);
  }

  return "正在设置自动化";
});

const statusDetailText = computed(() => {
  if (state.value === "error") return "自动化创建失败";
  if (state.value === "running") return "正在创建自动化";
  if (state.value === "pending") return "等待创建自动化";
  return "自动化已创建";
});

const canExpand = computed(() => Boolean(automation.value || promptPreview.value || props.result));
const canOpen = computed(() =>
  Boolean(props.onOpenAutomation && automation.value && !props.result?.isError),
);

async function openAutomationPage() {
  await props.onOpenAutomation?.(automation.value);
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
  <ToolCallCard
    :title="titleText"
    :state-label="stateLabel"
    :can-expand="false"
    :error="state === 'error'"
    :loading="state === 'running' || state === 'pending'"
  >
    <template #icon>
      <Clock3 class="size-3.5 shrink-0 text-muted-foreground" />
    </template>

    <template v-if="promptPreview" #summary>
      <Card class="w-[300px] max-w-[300px] py-3">
        <CardContent class="flex min-w-0 flex-row items-center justify-between gap-3 px-3">
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle
              class="flex min-w-0 items-center gap-2 overflow-hidden text-base whitespace-nowrap"
              :title="automationTitle"
            >
              <Clock3 class="size-4 shrink-0" />
              <span class="min-w-0 truncate">{{ automationTitle }}</span>
            </CardTitle>
            <CardDescription
              class="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap"
              :title="scheduleLabel"
            >
              <CalendarClock class="size-4 shrink-0" />
              <span class="min-w-0 truncate">{{ scheduleLabel }}</span>
            </CardDescription>
          </div>
          <Button
            v-if="canOpen"
            type="button"
            variant="outline"
            size="sm"
            class="shrink-0"
            @click.stop="openAutomationPage"
          >
            打开
          </Button>
        </CardContent>
      </Card>
    </template>
  </ToolCallCard>
</template>
