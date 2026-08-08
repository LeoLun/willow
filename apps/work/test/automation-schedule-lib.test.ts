import { describe, expect, it } from "vitest";
import {
  buildCronForMode,
  describeCronSchedule,
  detectScheduleMode,
  formatDateTime,
  formatDuration,
  parseCronTime,
  parseCronWeekdays,
  validateCronExpression,
} from "../src/renderer/src/lib/automation-schedule";

describe("automation schedule helpers", () => {
  it("detects schedule modes from cron expressions", () => {
    expect(detectScheduleMode("0 9 * * *")).toBe("daily_at");
    expect(detectScheduleMode("30 8 * * *")).toBe("daily_at");
    expect(detectScheduleMode("0 * * * *")).toBe("hourly");
    expect(detectScheduleMode("0 9 * * 1,3,5")).toBe("weekly_at");
    expect(detectScheduleMode("*/15 * * * *")).toBe("custom");
    expect(detectScheduleMode("0 9 1 * *")).toBe("custom");
    expect(detectScheduleMode("0 9 * * * *")).toBe("custom");
  });

  it("builds cron expressions for each mode", () => {
    expect(buildCronForMode("daily_at", { time: "09:30" })).toBe("30 9 * * *");
    expect(buildCronForMode("hourly", {})).toBe("0 * * * *");
    expect(buildCronForMode("weekly_at", { time: "08:00", weekdays: [1, 3] })).toBe("0 8 * * 1,3");
    expect(buildCronForMode("custom", { custom: "0 9 * * 1-5" })).toBe("0 9 * * 1-5");
    expect(buildCronForMode("weekly_at", { time: "08:00", weekdays: [] })).toBe("");
  });

  it("parses time and weekdays back from cron", () => {
    expect(parseCronTime("30 9 * * *")).toBe("09:30");
    expect(parseCronTime("0 * * * *")).toBeUndefined();
    expect(parseCronWeekdays("0 9 * * 1,3,5")).toEqual([1, 3, 5]);
    expect(parseCronWeekdays("0 9 * * 1-5")).toEqual([1, 2, 3, 4, 5]);
    expect(parseCronWeekdays("0 9 * * 0-6")).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(parseCronWeekdays("0 9 * * *")).toEqual([]);
  });

  it("describes cron schedules in Chinese", () => {
    expect(describeCronSchedule("0 * * * *")).toBe("每小时");
    expect(describeCronSchedule("30 9 * * *")).toBe("每天 09:30");
    expect(describeCronSchedule("0 9 * * 1,3")).toBe("每周一、三 09:00");
    expect(describeCronSchedule("0 9 * * 1-5")).toBe("每周一、二、三、四、五 09:00");
    expect(describeCronSchedule("0 9 1 * *")).toBe("自定义：0 9 1 * *");
    expect(describeCronSchedule("bad")).toBe("自定义：bad");
  });

  it("validates five-segment cron expressions", () => {
    expect(validateCronExpression("0 9 * * *")).toBeUndefined();
    expect(validateCronExpression("*/15 8-18 * * 1-5")).toBeUndefined();
    expect(validateCronExpression("0 9 * * * *")).toContain("5 段");
    expect(validateCronExpression("60 9 * * *")).toContain("无效");
    expect(validateCronExpression("0 25 * * *")).toContain("无效");
    expect(validateCronExpression("0 9 * * 8")).toContain("无效");
    expect(validateCronExpression("0 9 32 * *")).toContain("无效");
    expect(validateCronExpression("abc")).toContain("5 段");
  });

  it("formats durations", () => {
    expect(formatDuration(new Date("2026-08-08T00:00:00Z"), new Date("2026-08-08T00:00:45Z"))).toBe(
      "45 秒",
    );
    expect(formatDuration(new Date("2026-08-08T00:00:00Z"), new Date("2026-08-08T00:03:25Z"))).toBe(
      "3 分 25 秒",
    );
    expect(formatDuration(new Date("2026-08-08T00:00:00Z"), new Date("2026-08-08T01:02:03Z"))).toBe(
      "1 小时 2 分",
    );
  });

  it("formats dates with a timezone", () => {
    const date = new Date("2026-08-08T01:00:00.000Z");
    expect(formatDateTime(date, "UTC")).toContain("2026");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime(date, "Invalid/Zone")).toBeTruthy();
  });
});
