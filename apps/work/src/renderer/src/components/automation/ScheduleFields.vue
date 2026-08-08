<script setup lang="ts">
import type { AutomationScheduleMode } from "@shared/api";
import { Input } from "@willow/shadcn/components/ui/input";
import { Label } from "@willow/shadcn/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@willow/shadcn/components/ui/tabs";
import { TimePicker } from "@willow/shadcn/components/ui/time-picker";
import { ToggleGroup, ToggleGroupItem } from "@willow/shadcn/components/ui/toggle-group";
import { CalendarClock } from "lucide-vue-next";
import { computed } from "vue";
import {
  buildCronForMode,
  describeCronSchedule,
  validateCronExpression,
  WEEKDAY_OPTIONS,
} from "@/lib/automation-schedule";

const scheduleMode = defineModel<AutomationScheduleMode>("scheduleMode", { required: true });
const time = defineModel<string>("time", { default: "09:00" });
const weekdays = defineModel<number[]>("weekdays", { default: () => [1, 2, 3, 4, 5] });
const customCron = defineModel<string>("customCron", { default: "0 9 * * *" });

const props = withDefaults(
  defineProps<{
    timezone: string;
    disabled?: boolean;
  }>(),
  {
    disabled: false,
  },
);

const cronExpression = computed(() =>
  buildCronForMode(scheduleMode.value, {
    time: time.value,
    weekdays: weekdays.value,
    custom: customCron.value,
  }),
);
const customCronError = computed(() =>
  scheduleMode.value === "custom" ? validateCronExpression(customCron.value) : undefined,
);
const scheduleSummary = computed(() => describeCronSchedule(cronExpression.value));

const weekdaysModel = computed<string[]>({
  get: () => weekdays.value.map(String),
  set: (values) => {
    weekdays.value = values.map(Number);
  },
});
</script>

<template>
  <div class="grid gap-2">
    <Label>计划模式</Label>
    <Tabs v-model="scheduleMode" class="gap-0">
      <TabsList class="grid w-full grid-cols-4">
        <TabsTrigger value="daily_at" :disabled="disabled">每天</TabsTrigger>
        <TabsTrigger value="hourly" :disabled="disabled">每小时</TabsTrigger>
        <TabsTrigger value="weekly_at" :disabled="disabled">每周</TabsTrigger>
        <TabsTrigger value="custom" :disabled="disabled">自定义</TabsTrigger>
      </TabsList>
    </Tabs>

    <div v-if="scheduleMode === 'daily_at' || scheduleMode === 'weekly_at'" class="grid gap-3">
      <ToggleGroup
        v-if="scheduleMode === 'weekly_at'"
        v-model="weekdaysModel"
        type="multiple"
        variant="outline"
        :spacing="2"
        :disabled="disabled"
        class="flex-wrap"
      >
        <ToggleGroupItem
          v-for="option in WEEKDAY_OPTIONS"
          :key="option.value"
          :value="String(option.value)"
          class="hover:bg-muted data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
        >
          {{ option.label }}
        </ToggleGroupItem>
      </ToggleGroup>
      <div class="grid w-fit gap-2">
        <Label>时间</Label>
        <TimePicker v-model="time" :disabled="disabled" />
      </div>
    </div>

    <div v-if="scheduleMode === 'custom'" class="grid gap-2">
      <Label for="automation-cron">cron 表达式（分 时 日 月 周）</Label>
      <Input
        id="automation-cron"
        v-model="customCron"
        placeholder="例如：0 9 * * 1-5"
        :disabled="disabled"
      />
      <p v-if="customCronError" class="text-xs text-destructive" role="alert">
        {{ customCronError }}
      </p>
    </div>
  </div>
</template>
