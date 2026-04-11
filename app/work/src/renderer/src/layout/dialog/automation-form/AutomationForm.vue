<script setup lang="ts">
import type {
  Automation,
  AutomationScheduleMode,
  CreateAutomationRequest,
  UpdateAutomationRequest,
  Workspace,
} from "@shared/api";
import { Check, ChevronsUpDown } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import TimePicker from "@/components/automation/TimePicker.vue";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAutomationStore } from "@/stores/automation";

const props = defineProps<{
  workspaces: Workspace[];
  automation?: Automation;
  onCreated?: () => void;
  onSaved?: (automation: Automation) => void;
}>();

const emit = defineEmits<{
  close: [];
}>();

const automationStore = useAutomationStore();

const workspaceId = ref<number | null>(null);
const scheduleMode = ref<AutomationScheduleMode>("daily_at");
const dailyTime = ref("09:00");
const weeklyTime = ref("09:00");
const weeklyDays = ref<string[]>(["1"]);
const customCronExpression = ref("");
const prompt = ref("");
const loading = ref(false);
const submitError = ref("");

watch(
  () => [props.workspaces, props.automation] as const,
  ([nextWorkspaces, currentAutomation]) => {
    const initialWorkspaceId = currentAutomation?.workspaceId ?? nextWorkspaces[0]?.id ?? null;
    workspaceId.value = initialWorkspaceId;

    if (!currentAutomation) {
      scheduleMode.value = "daily_at";
      dailyTime.value = "09:00";
      weeklyTime.value = "09:00";
      weeklyDays.value = ["1"];
      customCronExpression.value = "";
      prompt.value = "";
      return;
    }

    prompt.value = currentAutomation.prompt;

    const parsedSchedule = inferScheduleFromAutomation(currentAutomation);
    scheduleMode.value = parsedSchedule.mode;
    dailyTime.value = parsedSchedule.dailyTime;
    weeklyTime.value = parsedSchedule.weeklyTime;
    weeklyDays.value = parsedSchedule.weeklyDays;
    customCronExpression.value = parsedSchedule.customCronExpression;
  },
  { immediate: true },
);

const selectedWorkspace = computed(
  () => props.workspaces.find((item) => item.id === workspaceId.value) ?? null,
);

const weekdayOptions = [
  { value: "0", label: "周日" },
  { value: "1", label: "周一" },
  { value: "2", label: "周二" },
  { value: "3", label: "周三" },
  { value: "4", label: "周四" },
  { value: "5", label: "周五" },
  { value: "6", label: "周六" },
];

const schedule = computed(() => {
  switch (scheduleMode.value) {
    case "hourly":
      return {
        mode: "hourly",
        cronExpression: "0 * * * *",
      };
    case "weekly_at": {
      const [hour, minute] = weeklyTime.value.split(":");
      const selectedDays = weekdayOptions
        .filter((item) => weeklyDays.value.includes(item.value))
        .map((item) => item.value);
      return {
        mode: "weekly_at",
        cronExpression: `${minute || "0"} ${hour || "0"} * * ${selectedDays.join(",")}`,
        weeklyDays: selectedDays.map((item) => Number(item)),
      };
    }
    case "custom":
      return {
        mode: "custom",
        cronExpression: customCronExpression.value.trim(),
      };
    case "daily_at":
    default: {
      const [hour, minute] = dailyTime.value.split(":");
      return {
        mode: "daily_at",
        cronExpression: `${minute || "0"} ${hour || "0"} * * *`,
        dailyTime: dailyTime.value,
      };
    }
  }
});

const weeklyDaysError = computed(() => {
  if (scheduleMode.value !== "weekly_at") {
    return "";
  }

  if (!weeklyDays.value.length) {
    return "请至少选择一个星期";
  }

  return "";
});

const customCronError = computed(() => {
  if (scheduleMode.value !== "custom") {
    return "";
  }

  const value = customCronExpression.value.trim();
  if (!value) {
    return "请输入 cron 表达式";
  }

  const parts = value.split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) {
    return "cron 表达式需要 5 或 6 段";
  }

  if (!/^[\d*/,\-A-Za-z? ]+$/.test(value)) {
    return "cron 表达式包含不支持的字符";
  }

  return "";
});

const isValid = computed(() => {
  return (
    !!workspaceId.value && !!prompt.value.trim() && !customCronError.value && !weeklyDaysError.value
  );
});

function getWeekdayButtonClass(index: number, value: string) {
  const isSelected = weeklyDays.value.includes(value);
  const isLastColumn = index === weekdayOptions.length - 1;

  return [
    "h-11 px-0 text-sm font-semibold transition-colors",
    "border-r bg-background",
    isSelected
      ? "bg-primary/10 text-primary hover:bg-primary/12"
      : "text-foreground hover:bg-muted/50",
    isLastColumn ? "border-r-0" : "",
  ];
}

function toggleWeeklyDay(day: string) {
  if (weeklyDays.value.includes(day)) {
    weeklyDays.value = weeklyDays.value.filter((item) => item !== day);
    return;
  }

  weeklyDays.value = [...weeklyDays.value, day];
}

async function handleSubmit() {
  submitError.value = "";

  if (!isValid.value || !workspaceId.value || loading.value) {
    return;
  }

  loading.value = true;
  try {
    const baseRequest = {
      prompt: prompt.value.trim(),
      trigger: {
        type: "schedule" as const,
        schedule: schedule.value,
      },
    };

    const automation = props.automation
      ? await automationStore.updateAutomation({
          id: props.automation.id,
          ...baseRequest,
        } satisfies UpdateAutomationRequest)
      : await automationStore.createAutomation({
          workspaceId: workspaceId.value,
          ...baseRequest,
        } satisfies CreateAutomationRequest);

    props.onCreated?.();
    props.onSaved?.(automation);
    emit("close");
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : submitButtonText.value + "失败";
  } finally {
    loading.value = false;
  }
}

const dialogTitle = computed(() => (props.automation ? "编辑自动化" : "添加自动化"));
const dialogDescription = computed(() =>
  props.automation
    ? "更新这条自动化的计划和提示词。"
    : "为某个工作空间配置定时提示词，让它按计划自动执行。",
);
const submitButtonText = computed(() => (props.automation ? "保存修改" : "创建自动化"));
const loadingText = computed(() => (props.automation ? "保存中..." : "创建中..."));

function inferScheduleFromAutomation(automation: Automation) {
  const cronExpression = automation.trigger?.cronExpression?.trim() ?? "";
  const parts = cronExpression.split(/\s+/);

  if (parts.length === 5) {
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (
      minute === "0" &&
      hour === "*" &&
      dayOfMonth === "*" &&
      month === "*" &&
      dayOfWeek === "*"
    ) {
      return {
        mode: "hourly" as AutomationScheduleMode,
        dailyTime: "09:00",
        weeklyTime: "09:00",
        weeklyDays: ["1"],
        customCronExpression: cronExpression,
      };
    }

    if (
      /^\d+$/.test(minute) &&
      /^\d+$/.test(hour) &&
      dayOfMonth === "*" &&
      month === "*" &&
      dayOfWeek === "*"
    ) {
      return {
        mode: "daily_at" as AutomationScheduleMode,
        dailyTime: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
        weeklyTime: "09:00",
        weeklyDays: ["1"],
        customCronExpression: cronExpression,
      };
    }

    if (
      /^\d+$/.test(minute) &&
      /^\d+$/.test(hour) &&
      dayOfMonth === "*" &&
      month === "*" &&
      dayOfWeek !== "*"
    ) {
      return {
        mode: "weekly_at" as AutomationScheduleMode,
        dailyTime: "09:00",
        weeklyTime: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
        weeklyDays: dayOfWeek.split(",").filter(Boolean),
        customCronExpression: cronExpression,
      };
    }
  }

  return {
    mode: "custom" as AutomationScheduleMode,
    dailyTime: "09:00",
    weeklyTime: "09:00",
    weeklyDays: ["1"],
    customCronExpression: cronExpression,
  };
}
</script>

<template>
  <DialogHeader>
    <DialogTitle>{{ dialogTitle }}</DialogTitle>
    <DialogDescription>{{ dialogDescription }}</DialogDescription>
  </DialogHeader>

  <form class="grid gap-5" @submit.prevent="handleSubmit">
    <div class="grid gap-4">
      <div class="grid gap-2">
        <Label for="automation-workspace">工作空间</Label>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              id="automation-workspace"
              type="button"
              variant="outline"
              class="h-11 w-full justify-between px-3 text-sm font-normal"
            >
              <span class="truncate">
                {{ selectedWorkspace?.name || "请选择工作空间" }}
              </span>
              <ChevronsUpDown class="size-4 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            class="w-[var(--reka-dropdown-menu-trigger-width)] min-w-[16rem]"
          >
            <DropdownMenuItem
              v-for="workspace in workspaces"
              :key="workspace.id"
              class="justify-between"
              @click="workspaceId = workspace.id"
            >
              <span>{{ workspace.name }}</span>
              <Check v-if="workspace.id === workspaceId" class="size-4 text-primary" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div class="grid gap-2">
        <Label>计划方式</Label>
        <ToggleGroup
          type="single"
          :model-value="scheduleMode"
          variant="outline"
          class="grid w-full grid-cols-2 md:grid-cols-4"
          @update:model-value="
            (value) => {
              if (value) scheduleMode = value as AutomationScheduleMode;
            }
          "
        >
          <ToggleGroupItem
            value="daily_at"
            class="justify-center data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            每天
          </ToggleGroupItem>
          <ToggleGroupItem
            value="hourly"
            class="justify-center data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            每小时
          </ToggleGroupItem>
          <ToggleGroupItem
            value="weekly_at"
            class="justify-center data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            每周
          </ToggleGroupItem>
          <ToggleGroupItem
            value="custom"
            class="justify-center data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            自定义
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div v-if="scheduleMode === 'daily_at'" class="grid gap-2">
        <Label for="automation-daily-time">每日执行时间</Label>
        <TimePicker id="automation-daily-time" v-model="dailyTime" />
      </div>

      <div v-else-if="scheduleMode === 'hourly'" class="rounded-lg border bg-muted/40 p-3 text-sm">
        每小时整点执行一次。
      </div>

      <div v-else-if="scheduleMode === 'weekly_at'" class="grid gap-3">
        <div class="grid gap-2">
          <Label>星期</Label>
          <div class="overflow-hidden rounded-md border">
            <div class="grid grid-cols-7">
              <button
                v-for="(option, index) in weekdayOptions"
                :key="option.value"
                type="button"
                :class="getWeekdayButtonClass(index, option.value)"
                @click="toggleWeeklyDay(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <p v-if="weeklyDaysError" class="text-xs text-destructive">{{ weeklyDaysError }}</p>
        </div>
        <div class="grid gap-2 md:max-w-[28rem]">
          <Label for="automation-weekly-time">执行时间</Label>
          <TimePicker id="automation-weekly-time" v-model="weeklyTime" />
        </div>
      </div>

      <div v-else class="grid gap-2">
        <Label for="automation-cron-expression">cron 表达式</Label>
        <Input
          id="automation-cron-expression"
          v-model="customCronExpression"
          placeholder="0 9 * * *"
        />
        <p class="text-xs text-muted-foreground">
          使用标准 cron 语法。当前支持 5 段或 6 段表达式。
        </p>
        <p v-if="customCronError" class="text-xs text-destructive">{{ customCronError }}</p>
      </div>

      <div class="grid gap-2">
        <Label for="automation-prompt">自动化提示词</Label>
        <Textarea
          id="automation-prompt"
          v-model="prompt"
          class="min-h-28"
          placeholder="输入自动化执行时要发送给 AI 的提示词"
        />
      </div>
    </div>

    <p v-if="submitError" class="text-sm text-destructive">{{ submitError }}</p>

    <DialogFooter>
      <Button type="button" variant="outline" @click="emit('close')">取消</Button>
      <Button type="submit" :disabled="!isValid || loading">
        {{ loading ? loadingText : submitButtonText }}
      </Button>
    </DialogFooter>
  </form>
</template>
