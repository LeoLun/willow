import { createRequire } from "node:module";
import path from "node:path";
import { ConfigService } from "@main/service/config.service";
import { WorkspaceDao } from "@main/service/dao/workspace.dao.service";
import { SessionService } from "@main/service/session.service";
import { Injectable } from "@willow/poetry";
import { powerMonitor } from "electron";
import cron from "node-cron";
import type { TaskContext } from "node-cron";
import { AutomationSchedulerService } from "./automation-scheduler.service";
import { AutomationRunDao } from "./dao/automation-run.dao.service";
import { AutomationTriggerDao } from "./dao/automation-trigger.dao.service";
import { AutomationDao } from "./dao/automation.dao.service";

const runtimeRequire = createRequire(__filename);
const nodeCronEntryPath = runtimeRequire.resolve("node-cron");
const nodeCronTimeMatcherPath = path.join(
  path.dirname(nodeCronEntryPath),
  "time",
  "time-matcher.js",
);

interface CronTimeMatcher {
  getNextMatch(date: Date): Date;
}

type AutomationRecord = ReturnType<AutomationDao["findById"]>;
type AutomationTriggerRecord = ReturnType<AutomationTriggerDao["findByAutomationId"]>;
type AutomationRunRecord = ReturnType<AutomationRunDao["findLatestByAutomationId"]>;

function createTimeMatcher(pattern: string, timezone?: string): CronTimeMatcher {
  const { TimeMatcher } = runtimeRequire(nodeCronTimeMatcherPath) as {
    TimeMatcher: new (pattern: string, timezone?: string) => CronTimeMatcher;
  };
  return new TimeMatcher(pattern, timezone);
}

export type AutomationStatus = "enabled" | "disabled";
export type AutomationTriggerType = "schedule";
export type AutomationRunKind = "scheduled" | "catch_up" | "manual";
export type AutomationRunStatus = "running" | "completed" | "failed";

export interface AutomationTriggerInput {
  type: AutomationTriggerType;
  cronExpression: string;
  timezone?: string;
}

export interface CreateAutomationInput {
  workspaceId: number;
  modelId?: string | null;
  title?: string;
  prompt: string;
  trigger: AutomationTriggerInput;
  status?: AutomationStatus;
}

export interface UpdateAutomationInput {
  workspaceId?: number;
  modelId?: string | null;
  title?: string;
  prompt?: string;
  status?: AutomationStatus;
  trigger?: AutomationTriggerInput;
}

interface ExecuteAutomationRunOptions {
  automation: NonNullable<AutomationRecord>;
  runKind: AutomationRunKind;
  scheduledFor: Date;
  triggeredAt: Date;
  updateScheduleAnchor: boolean;
  throwOnConflict: boolean;
}

@Injectable()
export class AutomationService {
  private readonly runningAutomationIds = new Set<number>();
  private isPowerMonitorSubscribed = false;

  constructor(
    private readonly automationDao: AutomationDao,
    private readonly automationTriggerDao: AutomationTriggerDao,
    private readonly automationRunDao: AutomationRunDao,
    private readonly automationSchedulerService: AutomationSchedulerService,
    private readonly workspaceDao: WorkspaceDao,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  listAutomations() {
    const automations = this.automationDao.findAll();
    const triggers = this.automationTriggerDao.findByAutomationIds(
      automations.map((item) => item.id),
    );
    const latestRuns = this.automationRunDao.findLatestByAutomationIds(
      automations.map((item) => item.id),
    );

    const triggerMap = new Map(triggers.map((item) => [item.automationId, item]));
    const latestRunMap = new Map<number, (typeof latestRuns)[number]>();
    for (const run of latestRuns) {
      if (!latestRunMap.has(run.automationId)) {
        latestRunMap.set(run.automationId, run);
      }
    }

    return automations.map((automation) => {
      const trigger = triggerMap.get(automation.id);
      const latestRun = latestRunMap.get(automation.id);
      return this.buildAutomationDetail(automation, trigger, latestRun);
    });
  }

  getAutomation(id: number) {
    const automation = this.requireAutomation(id);
    const trigger = this.requireTrigger(id);
    const latestRun = this.automationRunDao.findLatestByAutomationId(id);
    return this.buildAutomationDetail(automation, trigger, latestRun);
  }

  createAutomation(input: CreateAutomationInput) {
    this.requireWorkspace(input.workspaceId);
    this.validateTrigger(input.trigger);
    const modelId = this.resolveModelId(input.modelId);
    const now = new Date();
    const title = this.resolveTitle(input.title, input.prompt);
    const status = input.status ?? "enabled";
    const timezone = input.trigger.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

    const automation = this.automationDao.insert({
      workspaceId: input.workspaceId,
      modelId,
      title,
      prompt: input.prompt,
      status,
      triggerType: input.trigger.type,
      createdAt: now,
      updatedAt: now,
    });

    const trigger = this.automationTriggerDao.insert({
      automationId: automation.id,
      type: input.trigger.type,
      cronExpression: input.trigger.cronExpression,
      timezone,
      isActive: status === "enabled",
      createdAt: now,
      updatedAt: now,
    });

    if (status === "enabled") {
      void this.registerAutomation(automation.id);
    }

    return this.buildAutomationDetail(automation, trigger, undefined);
  }

  updateAutomation(id: number, input: UpdateAutomationInput) {
    const automation = this.requireAutomation(id);
    const currentTrigger = this.requireTrigger(id);

    if (input.trigger) {
      this.validateTrigger(input.trigger);
    }

    const nextWorkspaceId =
      input.workspaceId === undefined
        ? automation.workspaceId
        : this.requireWorkspace(input.workspaceId).id;
    const nextPrompt = input.prompt ?? automation.prompt;
    const nextStatus = input.status ?? automation.status;
    const nextModelId =
      input.modelId === undefined
        ? (automation.modelId ?? null)
        : this.resolveModelId(input.modelId);
    const nextTitle =
      input.title === undefined ? automation.title : this.resolveTitle(input.title, nextPrompt);
    const nextTrigger = input.trigger ?? {
      type: currentTrigger.type as AutomationTriggerType,
      cronExpression: currentTrigger.cronExpression,
      timezone: currentTrigger.timezone,
    };

    const updatedAutomation = this.automationDao.update(id, {
      workspaceId: nextWorkspaceId,
      modelId: nextModelId,
      prompt: nextPrompt,
      status: nextStatus,
      title: nextTitle,
      triggerType: nextTrigger.type,
    });

    const updatedTrigger = this.automationTriggerDao.update(currentTrigger.id, {
      type: nextTrigger.type,
      cronExpression: nextTrigger.cronExpression,
      timezone: nextTrigger.timezone ?? currentTrigger.timezone,
      isActive: nextStatus === "enabled",
    });

    if (nextStatus === "enabled") {
      void this.registerAutomation(id);
    } else {
      this.automationSchedulerService.unregister(id);
    }

    const latestRun = this.automationRunDao.findLatestByAutomationId(id);
    return this.buildAutomationDetail(updatedAutomation, updatedTrigger, latestRun);
  }

  deleteAutomation(id: number) {
    const automation = this.getAutomation(id);
    this.automationSchedulerService.unregister(id);
    this.automationDao.deleteById(id);
    return automation;
  }

  async restoreSchedules() {
    const automations = this.automationDao.findEnabledScheduleAutomations();
    for (const automation of automations) {
      await this.registerAutomation(automation.id);
      await this.runLatestMissedOccurrence(automation.id);
    }

    if (!this.isPowerMonitorSubscribed) {
      this.isPowerMonitorSubscribed = true;
      powerMonitor.on("resume", () => {
        console.log("System resumed. Restoring scheduled automations...");
        void this.restoreSchedules();
      });
    }
  }

  async runAutomationById(
    automationId: number,
    runKind: AutomationRunKind,
    scheduledFor: Date,
    triggeredAt = new Date(),
  ) {
    const automation = this.requireAutomation(automationId);
    const trigger = this.requireTrigger(automationId);

    if (automation.status !== "enabled" || trigger.isActive !== true) {
      return;
    }

    await this.executeAutomationRun({
      automation,
      runKind,
      scheduledFor,
      triggeredAt,
      updateScheduleAnchor: true,
      throwOnConflict: false,
    });
  }

  async runAutomationNow(automationId: number) {
    const automation = this.requireAutomation(automationId);
    const trigger = this.requireTrigger(automationId);

    if (automation.status !== "enabled" || trigger.isActive !== true) {
      throw new Error("automation is not enabled");
    }

    if (this.runningAutomationIds.has(automation.id)) {
      throw new Error("自动化正在执行中");
    }

    const now = new Date();
    this.runningAutomationIds.add(automation.id);

    const run = this.automationRunDao.insert({
      automationId: automation.id,
      scheduledFor: now,
      triggeredAt: now,
      runKind: "manual",
      status: "running",
      sessionId: null,
      errorMessage: null,
    });

    this.automationDao.update(automation.id, {
      lastRunAt: now,
    });

    try {
      const session = await this.sessionService.createSession(automation.workspaceId);
      this.automationRunDao.update(run.id, { sessionId: session.id });

      void this.sessionService
        .sendMessage(session.id, {
          message: automation.prompt,
          modelId: automation.modelId ?? undefined,
        })
        .then(() => {
          const completedAt = new Date();
          this.automationRunDao.update(run.id, {
            status: "completed",
            updatedAt: completedAt,
          });
          this.automationDao.update(automation.id, {
            lastCompletedAt: completedAt,
          });
        })
        .catch((error) => {
          this.automationRunDao.update(run.id, {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          console.error(
            `automation ${automation.id} manual run failed`,
            error instanceof Error ? error.message : error,
          );
        })
        .finally(() => {
          this.runningAutomationIds.delete(automation.id);
        });

      return {
        automation: this.getAutomation(automationId),
        session,
      };
    } catch (error) {
      this.automationRunDao.update(run.id, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      this.runningAutomationIds.delete(automation.id);
      throw error;
    }
  }

  private async executeAutomationRun({
    automation,
    runKind,
    scheduledFor,
    triggeredAt,
    updateScheduleAnchor,
    throwOnConflict,
  }: ExecuteAutomationRunOptions) {
    if (this.runningAutomationIds.has(automation.id)) {
      const message = `automation ${automation.id} skipped because another run is active`;
      if (throwOnConflict) {
        throw new Error("自动化正在执行中");
      }
      console.warn(message);
      return;
    }

    this.runningAutomationIds.add(automation.id);

    const run = this.automationRunDao.insert({
      automationId: automation.id,
      scheduledFor,
      triggeredAt,
      runKind,
      status: "running",
      sessionId: null,
      errorMessage: null,
    });

    this.automationDao.update(automation.id, {
      ...(updateScheduleAnchor ? { lastScheduledAt: scheduledFor } : {}),
      lastRunAt: triggeredAt,
    });

    try {
      const session = await this.sessionService.createSession(automation.workspaceId);
      this.automationRunDao.update(run.id, { sessionId: session.id });

      await this.sessionService.sendMessage(session.id, {
        message: automation.prompt,
        modelId: automation.modelId ?? undefined,
      });

      const completedAt = new Date();
      this.automationRunDao.update(run.id, {
        status: "completed",
        updatedAt: completedAt,
      });
      this.automationDao.update(automation.id, {
        lastCompletedAt: completedAt,
        ...(updateScheduleAnchor ? { lastScheduledAt: scheduledFor } : {}),
      });
    } catch (error) {
      this.automationRunDao.update(run.id, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      this.runningAutomationIds.delete(automation.id);
    }
  }

  private async registerAutomation(automationId: number) {
    const automation = this.requireAutomation(automationId);
    const trigger = this.requireTrigger(automationId);

    if (automation.status !== "enabled" || trigger.isActive !== true) {
      this.automationSchedulerService.unregister(automationId);
      return;
    }

    this.automationSchedulerService.reschedule(
      automationId,
      trigger.cronExpression,
      trigger.timezone,
      async (context: TaskContext) => {
        await this.runAutomationById(
          automationId,
          "scheduled",
          context.date ?? context.triggeredAt,
          context.triggeredAt,
        );
      },
    );
  }

  private async runLatestMissedOccurrence(automationId: number) {
    const automation = this.requireAutomation(automationId);
    const trigger = this.requireTrigger(automationId);
    const anchor = automation.lastScheduledAt ?? automation.createdAt;
    if (!anchor) {
      return;
    }

    const matcher = createTimeMatcher(trigger.cronExpression, trigger.timezone);
    const now = new Date();
    let cursor = anchor;
    let latestMissed: Date | null = null;
    let step = 0;

    while (step < 10000) {
      const next = matcher.getNextMatch(cursor);
      if (next.getTime() > now.getTime()) {
        break;
      }
      latestMissed = next;
      cursor = next;
      step += 1;
    }

    if (!latestMissed) {
      return;
    }

    if (
      automation.lastScheduledAt &&
      latestMissed.getTime() <= automation.lastScheduledAt.getTime()
    ) {
      return;
    }

    await this.runAutomationById(automationId, "catch_up", latestMissed, now);
  }

  private requireAutomation(id: number) {
    const automation = this.automationDao.findById(id);
    if (!automation) {
      throw new Error("automation not found");
    }
    return automation;
  }

  private requireWorkspace(workspaceId: number) {
    const workspace = this.workspaceDao.findById(workspaceId);
    if (!workspace) {
      throw new Error("workspace not found");
    }
    return workspace;
  }

  private requireTrigger(automationId: number) {
    const trigger = this.automationTriggerDao.findByAutomationId(automationId);
    if (!trigger) {
      throw new Error("automation trigger not found");
    }
    return trigger;
  }

  private validateTrigger(trigger: AutomationTriggerInput) {
    if (trigger.type !== "schedule") {
      throw new Error("unsupported automation trigger type");
    }
    if (!trigger.cronExpression || !cron.validate(trigger.cronExpression)) {
      throw new Error("invalid cron expression");
    }
  }

  private resolveTitle(title: string | undefined, prompt: string) {
    const normalizedTitle = title?.trim();
    if (normalizedTitle) {
      return normalizedTitle;
    }

    const normalized = prompt.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return "未命名自动化";
    }
    return normalized.slice(0, 24);
  }

  private resolveModelId(modelId: string | null | undefined) {
    if (modelId === undefined || modelId === null) {
      return null;
    }

    const normalized = modelId.trim();
    if (!normalized) {
      return null;
    }

    const baseModelId = normalized.includes(":") ? normalized.split(":")[0] : normalized;
    if (!this.configService.getModelByModelId(baseModelId)) {
      throw new Error("model not found");
    }

    return normalized;
  }

  private buildAutomationDetail(
    automation: AutomationRecord,
    trigger: AutomationTriggerRecord | undefined,
    latestRun: AutomationRunRecord | undefined,
  ) {
    if (!automation) {
      throw new Error("automation not found");
    }

    return {
      ...automation,
      modelId: automation.modelId ?? null,
      status: automation.status as AutomationStatus,
      triggerType: automation.triggerType as AutomationTriggerType,
      trigger: trigger
        ? {
            id: trigger.id,
            automationId: trigger.automationId,
            type: trigger.type as AutomationTriggerType,
            cronExpression: trigger.cronExpression,
            timezone: trigger.timezone,
            isActive: trigger.isActive,
            createdAt: trigger.createdAt,
            updatedAt: trigger.updatedAt,
            summary: this.buildTriggerSummary(trigger.cronExpression, trigger.timezone),
          }
        : undefined,
      latestRun: latestRun
        ? {
            id: latestRun.id,
            automationId: latestRun.automationId,
            scheduledFor: latestRun.scheduledFor,
            triggeredAt: latestRun.triggeredAt,
            runKind: latestRun.runKind as AutomationRunKind,
            status: latestRun.status as AutomationRunStatus,
            sessionId: latestRun.sessionId,
            errorMessage: latestRun.errorMessage,
            createdAt: latestRun.createdAt,
            updatedAt: latestRun.updatedAt,
          }
        : undefined,
    };
  }

  private buildTriggerSummary(cronExpression: string, timezone: string) {
    return `${cronExpression} (${timezone})`;
  }
}
