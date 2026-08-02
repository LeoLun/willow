import type { Message } from "./types";

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

function padTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function formatTime(date: Date): string {
  return `${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}`;
}

function startOfLocalWeek(date: Date): Date {
  const dayOffset = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOffset);
}

export function formatMessageTimestamp(timestamp: number, now = new Date()): string {
  const date = new Date(timestamp);
  const time = formatTime(date);
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) return time;

  const weekStart = startOfLocalWeek(now);
  const nextWeekStart = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 7,
  );
  if (date >= weekStart && date < nextWeekStart) {
    return `${WEEKDAY_LABELS[date.getDay()]} ${time}`;
  }

  return `${date.getFullYear()}年${padTwoDigits(date.getMonth() + 1)}月${padTwoDigits(date.getDate())}日 ${time}`;
}

export function getMessageCopyText(message: Message): string {
  return message.content
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join("\n\n");
}
