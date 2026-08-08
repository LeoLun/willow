import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutomationSchedulerService } from "../src/main/service/automation-scheduler.service";

describe("AutomationSchedulerService", () => {
  let scheduler: AutomationSchedulerService;

  beforeEach(() => {
    scheduler = new AutomationSchedulerService();
  });

  afterEach(() => {
    scheduler.unregisterAll();
    vi.useRealTimers();
  });

  it("registers, reschedules, and unregisters tasks", () => {
    const handler = vi.fn();
    scheduler.register(1, "0 9 * * *", "UTC", handler);
    expect(scheduler.isRegistered(1)).toBe(true);
    expect(scheduler.getRegisteredCount()).toBe(1);

    scheduler.register(1, "0 10 * * *", "UTC", handler);
    expect(scheduler.isRegistered(1)).toBe(true);
    expect(scheduler.getRegisteredCount()).toBe(1);

    scheduler.unregister(1);
    expect(scheduler.isRegistered(1)).toBe(false);
    expect(scheduler.getRegisteredCount()).toBe(0);
  });

  it("fires the handler at the scheduled minute with the scheduled date", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-08T08:59:00.000Z");
    vi.setSystemTime(now);

    const handler = vi.fn();
    scheduler.register(1, "0 9 * * *", "UTC", handler);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(handler).toHaveBeenCalledTimes(1);
    const firedAt = handler.mock.calls[0]?.[0] as Date;
    expect(firedAt.toISOString()).toBe("2026-08-08T09:00:00.000Z");
  });

  it("honors the registered timezone when firing", async () => {
    vi.useFakeTimers();
    // 00:59 UTC == 08:59 in Asia/Shanghai; the 09:00 Shanghai schedule fires at 01:00 UTC.
    const now = new Date("2026-08-08T00:59:00.000Z");
    vi.setSystemTime(now);

    const handler = vi.fn();
    scheduler.register(1, "0 9 * * *", "Asia/Shanghai", handler);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(handler).toHaveBeenCalledTimes(1);
    const firedAt = handler.mock.calls[0]?.[0] as Date;
    expect(firedAt.toISOString()).toBe("2026-08-08T01:00:00.000Z");
  });

  it("unregisterAll stops every task", () => {
    const handler = vi.fn();
    scheduler.register(1, "0 9 * * *", "UTC", handler);
    scheduler.register(2, "0 10 * * *", "UTC", handler);

    scheduler.unregisterAll();
    expect(scheduler.getRegisteredCount()).toBe(0);
    expect(scheduler.isRegistered(1)).toBe(false);
    expect(scheduler.isRegistered(2)).toBe(false);
  });
});
