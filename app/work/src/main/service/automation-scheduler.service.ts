import { Injectable } from "@willow/poetry";
import cron from "node-cron";
import type { ScheduledTask, TaskContext } from "node-cron";

@Injectable()
export class AutomationSchedulerService {
  private readonly tasks = new Map<number, ScheduledTask>();

  register(
    automationId: number,
    cronExpression: string,
    timezone: string,
    handler: (context: TaskContext) => Promise<void>,
  ) {
    this.unregister(automationId);

    const task = cron.schedule(cronExpression, handler, {
      timezone,
      noOverlap: true,
      name: `automation-${automationId}`,
    });

    this.tasks.set(automationId, task);
    return task;
  }

  unregister(automationId: number) {
    const task = this.tasks.get(automationId);
    if (!task) {
      return;
    }
    task.stop();
    task.destroy();
    this.tasks.delete(automationId);
  }

  reschedule(
    automationId: number,
    cronExpression: string,
    timezone: string,
    handler: (context: TaskContext) => Promise<void>,
  ) {
    return this.register(automationId, cronExpression, timezone, handler);
  }

  unregisterAll() {
    for (const automationId of this.tasks.keys()) {
      this.unregister(automationId);
    }
  }

  getTask(automationId: number) {
    return this.tasks.get(automationId);
  }
}
