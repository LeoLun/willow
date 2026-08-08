import type { AutomationRunKind, AutomationRunStatus, AutomationScheduleMode } from "@shared/api";

export const AUTOMATION_RUN_STATUS_LABELS: Record<AutomationRunStatus, string> = {
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  skipped: "已跳过",
  interrupted: "已中断",
};

export const AUTOMATION_RUN_KIND_LABELS: Record<AutomationRunKind, string> = {
  scheduled: "定时",
  catch_up: "补跑",
  manual: "手动",
};

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "周日" },
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
] as const;

const WEEKDAY_NAMES: Record<number, string> = {
  0: "日",
  1: "一",
  2: "二",
  3: "三",
  4: "四",
  5: "五",
  6: "六",
  7: "日",
};

export function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function detectScheduleMode(cronExpression: string): AutomationScheduleMode {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return "custom";
  const [minute, hour, dom, month, dow] = parts;
  if (minute === "0" && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return "hourly";
  }
  if (
    dom === "*" &&
    month === "*" &&
    dow === "*" &&
    isSimpleClockValue(minute) &&
    isSimpleClockValue(hour)
  ) {
    return "daily_at";
  }
  if (dom === "*" && month === "*" && isSimpleClockValue(minute) && isSimpleClockValue(hour)) {
    return "weekly_at";
  }
  return "custom";
}

function isSimpleClockValue(value: string): boolean {
  if (value === "*" || value.includes(",") || value.includes("-") || value.includes("/")) {
    return false;
  }
  return /^\d{1,2}$/.test(value);
}

export function buildCronForMode(
  mode: AutomationScheduleMode,
  values: { time?: string; weekdays?: number[]; custom?: string },
): string {
  if (mode === "hourly") return "0 * * * *";
  if (mode === "custom") return values.custom?.trim() || "";
  if (!values.time || !/^\d{1,2}:\d{1,2}$/.test(values.time)) return "";

  const [hourValue, minuteValue] = values.time.split(":");
  const hour = String(Number(hourValue));
  const minute = String(Number(minuteValue));
  if (mode === "daily_at") return `${minute} ${hour} * * *`;
  const weekdays = values.weekdays?.slice().sort((a, b) => a - b) ?? [];
  if (weekdays.length === 0) return "";
  return `${minute} ${hour} * * ${weekdays.join(",")}`;
}
export function parseCronTime(cronExpression: string): string | undefined {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return undefined;
  const [minute, hour] = parts;
  if (!/^\d{1,2}$/.test(minute) || !/^\d{1,2}$/.test(hour)) return undefined;
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function parseCronWeekdays(cronExpression: string): number[] {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return [];
  const dow = parts[4];
  if (dow === "*" || dow.includes("/")) return [];
  const weekdays: number[] = [];
  for (const part of dow.split(",")) {
    const single = /^\d{1,2}$/.exec(part);
    if (single) {
      const value = Number(single[0]);
      if (value >= 0 && value <= 7) weekdays.push(value);
      continue;
    }
    const range = /^(\d{1,2})-(\d{1,2})$/.exec(part);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (from >= 0 && to <= 7 && from <= to) {
        for (let day = from; day <= to; day += 1) weekdays.push(day);
      }
    }
  }
  return weekdays;
}

export function describeCronSchedule(cronExpression: string): string {
  const mode = detectScheduleMode(cronExpression);
  if (mode === "hourly") return "每小时";
  if (mode === "custom") return `自定义：${cronExpression.trim()}`;
  if (mode === "daily_at") {
    const time = parseCronTime(cronExpression);
    return time ? `每天 ${time}` : cronExpression.trim();
  }
  const time = parseCronTime(cronExpression);
  const weekdays = parseCronWeekdays(cronExpression);
  if (time && weekdays.length > 0) {
    const names = weekdays.map((day) => WEEKDAY_NAMES[day]).join("、");
    return `每周${names} ${time}`;
  }
  return `自定义：${cronExpression.trim()}`;
}

export function describeWeekdays(weekdays: number[]): string {
  return weekdays.map((day) => WEEKDAY_NAMES[day] ?? String(day)).join("、");
}

function isValidCronField(value: string, min: number, max: number): boolean {
  if (value === "*") return true;
  for (const part of value.split(",")) {
    if (part === "*") continue;
    if (part.startsWith("*/")) {
      const step = Number(part.slice(2));
      if (!Number.isInteger(step) || step < 1) return false;
      continue;
    }
    const rangeMatch = /^(\d{1,2})-(\d{1,2})(?:\/(\d{1,2}))?$/.exec(part);
    if (rangeMatch) {
      const from = Number(rangeMatch[1]);
      const to = Number(rangeMatch[2]);
      const step = rangeMatch[3] === undefined ? undefined : Number(rangeMatch[3]);
      if (from < min || to > max || from > to) return false;
      if (step !== undefined && step < 1) return false;
      continue;
    }
    const single = /^(\d{1,2})(?:\/(\d{1,2}))?$/.exec(part);
    if (!single) return false;
    const valueNumber = Number(single[1]);
    const step = single[2] === undefined ? undefined : Number(single[2]);
    if (valueNumber < min || valueNumber > max) return false;
    if (step !== undefined && step < 1) return false;
  }
  return true;
}

/** 返回校验错误文案；合法时返回 undefined。 */
export function validateCronExpression(expression: string): string | undefined {
  const trimmed = expression.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    return "cron 表达式必须为 5 段（分 时 日 月 周）";
  }
  const fields: Array<[string, number, number]> = [
    [parts[0], 0, 59],
    [parts[1], 0, 23],
    [parts[2], 1, 31],
    [parts[3], 1, 12],
    [parts[4], 0, 7],
  ];
  for (const [field, min, max] of fields) {
    if (!isValidCronField(field, min, max)) {
      return "cron 表达式包含无效字段";
    }
  }
  return undefined;
}

export function formatDateTime(date: Date | undefined, timezone?: string): string {
  if (!date) return "—";
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };
  try {
    return new Intl.DateTimeFormat("zh-CN", { ...options, timeZone: timezone }).format(date);
  } catch {
    return new Intl.DateTimeFormat("zh-CN", options).format(date);
  }
}

export function formatDuration(startedAt: Date, finishedAt: Date): string {
  const seconds = Math.max(0, Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分 ${seconds % 60} 秒`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时 ${minutes % 60} 分`;
}
