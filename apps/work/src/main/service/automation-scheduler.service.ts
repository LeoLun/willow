import { Injectable } from "@willow/poetry";
import cron from "node-cron";
import type { ScheduledTask } from "node-cron";

export type ScheduledTaskHandler = (date: Date) => void;

/**
 * 包装 node-cron 的运行时调度器。
 *
 * 每个自动化最多对应一个 ScheduledTask；register 会先注销旧任务再按最新的
 * cron 表达式与时区注册，保证调度始终反映持久化状态。
 */
@Injectable()
export class AutomationSchedulerService {
  private readonly tasks = new Map<number, ScheduledTask>();

  register(
    automationId: number,
    cronExpression: string,
    timezone: string,
    handler: ScheduledTaskHandler,
  ): void {
    this.unregister(automationId);
    const task = cron.schedule(
      cronExpression,
      (context) => {
        handler(context.date);
      },
      { timezone, name: `automation:${automationId}` },
    );
    this.tasks.set(automationId, task);
  }

  reschedule(
    automationId: number,
    cronExpression: string,
    timezone: string,
    handler: ScheduledTaskHandler,
  ): void {
    this.register(automationId, cronExpression, timezone, handler);
  }

  unregister(automationId: number): void {
    const task = this.tasks.get(automationId);
    if (!task) return;
    void task.stop();
    void task.destroy();
    this.tasks.delete(automationId);
  }

  unregisterAll(): void {
    for (const automationId of [...this.tasks.keys()]) {
      this.unregister(automationId);
    }
  }

  isRegistered(automationId: number): boolean {
    return this.tasks.has(automationId);
  }

  getRegisteredCount(): number {
    return this.tasks.size;
  }
}
