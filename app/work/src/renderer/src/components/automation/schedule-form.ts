import type { Automation, AutomationScheduleInput, AutomationScheduleMode } from "@shared/api";
import { computed, ref } from "vue";

export const automationWeekdayOptions = [
  { value: "1", label: "一" },
  { value: "2", label: "二" },
  { value: "3", label: "三" },
  { value: "4", label: "四" },
  { value: "5", label: "五" },
  { value: "6", label: "六" },
  { value: "0", label: "日" },
] as const;

export function inferScheduleFromAutomation(automation: Automation) {
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

export function useAutomationScheduleForm() {
  const scheduleMode = ref<AutomationScheduleMode>("daily_at");
  const dailyTime = ref("09:00");
  const weeklyTime = ref("09:00");
  const weeklyDays = ref<string[]>(["1"]);
  const customCronExpression = ref("");

  const schedule = computed<AutomationScheduleInput>(() => {
    switch (scheduleMode.value) {
      case "hourly":
        return {
          mode: "hourly",
          cronExpression: "0 * * * *",
        };
      case "weekly_at": {
        const [hour, minute] = weeklyTime.value.split(":");
        const selectedDays = automationWeekdayOptions
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

    return weeklyDays.value.length ? "" : "请至少选择一个星期";
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

  function applyAutomationSchedule(automation: Automation) {
    const parsed = inferScheduleFromAutomation(automation);
    scheduleMode.value = parsed.mode;
    dailyTime.value = parsed.dailyTime;
    weeklyTime.value = parsed.weeklyTime;
    weeklyDays.value = parsed.weeklyDays;
    customCronExpression.value = parsed.customCronExpression;
  }

  function getWeekdayButtonClass(value: string) {
    const selected = weeklyDays.value.includes(value);
    return [
      selected
        ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
        : "text-foreground hover:bg-muted/50",
    ];
  }

  function toggleWeeklyDay(day: string) {
    if (weeklyDays.value.includes(day)) {
      weeklyDays.value = weeklyDays.value.filter((item) => item !== day);
      return;
    }
    weeklyDays.value = [...weeklyDays.value, day];
  }

  return {
    scheduleMode,
    dailyTime,
    weeklyTime,
    weeklyDays,
    customCronExpression,
    schedule,
    weeklyDaysError,
    customCronError,
    applyAutomationSchedule,
    getWeekdayButtonClass,
    toggleWeeklyDay,
  };
}
