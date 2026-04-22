import type { Automation, AutomationRunSummary } from "@shared/api";

const WEEKDAY_LABELS: Record<string, string> = {
  "0": "日",
  "1": "一",
  "2": "二",
  "3": "三",
  "4": "四",
  "5": "五",
  "6": "六",
  "7": "日",
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseCron(cronExpression: string) {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

function isNumeric(value: string) {
  return /^\d+$/.test(value);
}

function weekdayLabel(value: string) {
  return WEEKDAY_LABELS[value] ?? "";
}

function formatAbsoluteTime(date: Date | string | null | undefined) {
  if (!date) {
    return "未运行";
  }

  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return "未运行";
  }

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function isToday(date: Date, reference = new Date()) {
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

function isTomorrow(date: Date, reference = new Date()) {
  const tomorrow = new Date(reference);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  );
}

export function formatAutomationSchedule(cronExpression: string) {
  const parsed = parseCron(cronExpression);
  if (!parsed) {
    return cronExpression || "未配置";
  }

  const { minute, hour, dayOfMonth, month, dayOfWeek } = parsed;
  if (minute === "0" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "每小时";
  }

  if (
    isNumeric(minute) &&
    isNumeric(hour) &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    return `每天 ${Number(hour)}:${minute.padStart(2, "0")}`;
  }

  if (
    isNumeric(minute) &&
    isNumeric(hour) &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek !== "*"
  ) {
    const weekdays = dayOfWeek
      .split(",")
      .map((value) => weekdayLabel(value))
      .filter(Boolean)
      .join("、");
    return weekdays ? `每周${weekdays} ${Number(hour)}:${minute.padStart(2, "0")}` : cronExpression;
  }

  return cronExpression;
}

export function getAutomationWorkspaceLabel(automation: Automation, workspaceName?: string) {
  return workspaceName ?? `工作空间 #${automation.workspaceId}`;
}

export function getAutomationRowMeta(automation: Automation, workspaceName?: string) {
  return getAutomationWorkspaceLabel(automation, workspaceName);
}

export function getAutomationSummary(automation: Automation) {
  const firstLine = automation.prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ?? "查看自动化详情";
}

export function getAutomationNextRunLabel(automation: Automation, now = new Date()) {
  const cronExpression = automation.trigger?.cronExpression?.trim();
  if (!cronExpression) {
    return "未配置";
  }

  const parsed = parseCron(cronExpression);
  if (!parsed) {
    return "按计划运行";
  }

  const { minute, hour, dayOfMonth, month, dayOfWeek } = parsed;
  if (minute === "0" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return `今天 ${pad(next.getHours())}:00`;
  }

  if (
    isNumeric(minute) &&
    isNumeric(hour) &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek === "*"
  ) {
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setHours(Number(hour), Number(minute), 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    if (isToday(next, now)) {
      return `今天 ${pad(next.getHours())}:${pad(next.getMinutes())}`;
    }
    if (isTomorrow(next, now)) {
      return `明天 ${pad(next.getHours())}:${pad(next.getMinutes())}`;
    }
    return formatAbsoluteTime(next);
  }

  if (
    isNumeric(minute) &&
    isNumeric(hour) &&
    dayOfMonth === "*" &&
    month === "*" &&
    dayOfWeek !== "*"
  ) {
    const days = dayOfWeek
      .split(",")
      .filter(isNumeric)
      .map((value) => Number(value) % 7)
      .sort((left, right) => left - right);
    if (days.length === 0) {
      return "按计划运行";
    }

    for (let offset = 0; offset < 7; offset += 1) {
      const candidate = new Date(now);
      candidate.setSeconds(0, 0);
      candidate.setDate(candidate.getDate() + offset);
      candidate.setHours(Number(hour), Number(minute), 0, 0);
      if (days.includes(candidate.getDay()) && candidate.getTime() > now.getTime()) {
        if (isToday(candidate, now)) {
          return `今天 ${pad(candidate.getHours())}:${pad(candidate.getMinutes())}`;
        }
        if (isTomorrow(candidate, now)) {
          return `明天 ${pad(candidate.getHours())}:${pad(candidate.getMinutes())}`;
        }
        return `周${weekdayLabel(String(candidate.getDay()))} ${pad(candidate.getHours())}:${pad(candidate.getMinutes())}`;
      }
    }
  }

  return "按计划运行";
}

export function getAutomationStatusLabel(status: Automation["status"]) {
  return status === "enabled" ? "活跃" : "已停用";
}

export function getAutomationStatusVariant(status: Automation["status"]) {
  return status === "enabled" ? "secondary" : "outline";
}

export function getAutomationRunStatusLabel(run: AutomationRunSummary | undefined) {
  if (!run) {
    return "从未运行";
  }

  const statusMap: Record<AutomationRunSummary["status"], string> = {
    running: "运行中",
    completed: "已完成",
    failed: "失败",
  };
  return statusMap[run.status];
}

export function getAutomationLastRunLabel(automation: Automation) {
  const date = automation.latestRun?.triggeredAt ?? automation.lastRunAt;
  return formatAbsoluteTime(date);
}

export function getAutomationPreviousRunText(automation: Automation) {
  if (!automation.latestRun) {
    return "无线程";
  }

  const parts = [
    getAutomationRunStatusLabel(automation.latestRun),
    formatAbsoluteTime(automation.latestRun.triggeredAt),
  ];
  if (automation.latestRun.sessionId) {
    parts.push(`会话 #${automation.latestRun.sessionId}`);
  }
  return parts.join(" · ");
}

export function getAutomationRunKindLabel(run: AutomationRunSummary | undefined) {
  if (!run) {
    return "暂无更多历史";
  }

  if (run.runKind === "manual") {
    return "手动执行";
  }

  return run.runKind === "catch_up" ? "补跑" : "按计划运行";
}
