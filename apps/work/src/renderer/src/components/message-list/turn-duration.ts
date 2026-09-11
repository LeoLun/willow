import type { Message } from "./types";

export function formatTurnDuration(messages: readonly Message[]): string {
  const start = messages.find((message) => message.role === "user");
  const end = messages.findLast((message) => message.role !== "user");
  if (
    !start ||
    !end ||
    !Number.isFinite(start.timestamp) ||
    start.timestamp <= 0 ||
    end.completedAt === undefined ||
    !Number.isFinite(end.completedAt) ||
    end.completedAt < start.timestamp
  )
    return "用时未知";
  const seconds = Math.max(0, Math.floor((end.completedAt - start.timestamp) / 1000));
  if (seconds === 0) return "用时 <1s";
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const parts = [`${hours}h`];
    if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
    if (seconds % 60 > 0) parts.push(`${seconds % 60}s`);
    return `用时 ${parts.join(" ")}`;
  }
  if (minutes > 0) return `用时 ${minutes}m${seconds % 60 > 0 ? ` ${seconds % 60}s` : ""}`;
  return `用时 ${seconds}s`;
}
