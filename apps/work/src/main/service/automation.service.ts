import type {
  AutomationInfo,
  AutomationListItem,
  AutomationRunInfo,
  AutomationStatus,
  AutomationTriggerType,
  AutomationRunKind,
  CreateAutomationRequest,
  ListAutomationRunsResponse,
  ModelConfig,
  UpdateAutomationRequest,
} from "@shared/api";
import { AUTOMATION_CHANGED_EVENT } from "@shared/constants";
import type {
  CreateAutomationToolInput,
  CreateAutomationToolResult,
  DeleteAutomationToolInput,
  DeleteAutomationToolResult,
  ListAutomationsToolResult,
  UpdateAutomationToolInput,
  UpdateAutomationToolResult,
} from "@willow/core";
import { Injectable } from "@willow/poetry";
import { CronExpressionParser } from "cron-parser";
import cron from "node-cron";
import type { Automation, AutomationTrigger } from "../db/schema";
import { AgentService } from "./agent.service";
import { AutomationSchedulerService } from "./automation-scheduler.service";
import { AutomationRunDao } from "./dao/automation-run.dao.server";
import { AutomationTriggerDao } from "./dao/automation-trigger.dao.server";
import { AutomationDao, type AutomationWithTrigger } from "./dao/automation.dao.server";
import { WorkspaceDao } from "./dao/workspace.dao.server";
import { EventService } from "./event.service";
import { MessageService, UnattendedInteractionError } from "./message.service";
import { SessionService } from "./session.service";
import { UserConfigService } from "./user-config.service";

const RUN_HISTORY_DEFAULT_LIMIT = 20;
const TITLE_FALLBACK = "未命名自动化";
const TITLE_MAX_LENGTH = 24;
const INTERRUPTED_MESSAGE = "应用退出导致运行中断。";
const OVERLAP_MESSAGE = "上一轮仍在执行，本次触发已跳过。";
const GENERIC_RUN_ERROR = "自动化执行失败，请稍后重试。";

function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export class AutomationNotFoundError extends Error {
  constructor(automationId: number) {
    super(`Automation not found: ${automationId}`);
    this.name = "AutomationNotFoundError";
  }
}

export class AutomationRunningConflictError extends Error {
  constructor(automationId: number) {
    super(`Automation is currently running: ${automationId}`);
    this.name = "AutomationRunningConflictError";
  }
}

export class AutomationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutomationValidationError";
  }
}

/**
 * 负责自动化 CRUD、调度注册、漏跑补偿与无人值守执行编排。
 */
@Injectable()
export class AutomationService {
  private readonly activeRuns = new Set<number>();
  private readonly locks = new Map<number, Promise<void>>();

  constructor(
    private readonly automationDao: AutomationDao,
    private readonly automationTriggerDao: AutomationTriggerDao,
    private readonly automationRunDao: AutomationRunDao,
    private readonly workspaceDao: WorkspaceDao,
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
    private readonly agentService: AgentService,
    private readonly userConfigService: UserConfigService,
    private readonly scheduler: AutomationSchedulerService,
    private readonly eventService: EventService,
  ) {}

  /** 应用启动时调用：收口遗留运行，加载并注册启用的自动化，随后检查漏跑。 */
  async initialize(): Promise<void> {
    this.automationRunDao.markAllRunningInterrupted(new Date(), INTERRUPTED_MESSAGE);
    for (const automation of this.automationDao.findEnabledWithActiveTriggers()) {
      await this.withLock(automation.id, async () => {
        await this.checkMissedRun(automation);
        this.registerAutomation(automation.id);
      });
    }
  }

  /** 系统休眠恢复时调用：确保调度仍注册，并再次检查漏跑。 */
  async onSystemResume(): Promise<void> {
    for (const automation of this.automationDao.findEnabledWithActiveTriggers()) {
      await this.withLock(automation.id, async () => {
        if (!this.scheduler.isRegistered(automation.id)) {
          this.registerAutomation(automation.id);
        }
        await this.checkMissedRun(automation);
      });
    }
  }

  /** 应用退出前调用：注销全部任务并收口仍在运行的记录。 */
  async shutdown(): Promise<void> {
    this.scheduler.unregisterAll();
    this.automationRunDao.markAllRunningInterrupted(new Date(), INTERRUPTED_MESSAGE);
  }

  listAutomations(): AutomationListItem[] {
    const automations = this.automationDao.findAll();
    const workspaceNames = new Map(
      this.workspaceDao.listAll().map((workspace) => [workspace.id, workspace.name]),
    );
    return automations.map((automation) => {
      const trigger = this.automationTriggerDao.findByAutomationId(automation.id);
      const lastRun = this.automationRunDao.findLatestByAutomation(automation.id);
      return {
        id: automation.id,
        workspaceId: automation.workspaceId,
        workspaceName: workspaceNames.get(automation.workspaceId) ?? "",
        title: automation.title,
        status: automation.status,
        cronExpression: trigger?.cronExpression ?? "",
        timezone: trigger?.timezone ?? "",
        nextRunAt: trigger ? this.computeNextRunAt(automation, trigger) : undefined,
        lastRun: lastRun
          ? {
              status: lastRun.status,
              runKind: lastRun.runKind,
              triggeredAt: lastRun.triggeredAt,
              finishedAt: lastRun.finishedAt ?? undefined,
            }
          : undefined,
        createdAt: automation.createdAt,
        updatedAt: automation.updatedAt,
      };
    });
  }

  getAutomation(automationId: number): AutomationInfo {
    const automation = this.automationDao.findWithTriggerById(automationId);
    if (!automation) {
      throw new AutomationNotFoundError(automationId);
    }
    return this.toAutomationInfo(automation);
  }

  createAutomation(request: CreateAutomationRequest): AutomationInfo {
    this.validateWorkspace(request.workspaceId);
    const prompt = this.validatePrompt(request.prompt);
    const title = this.buildTitle(request.title, prompt);
    const status = this.validateStatus(request.status ?? "enabled");
    const model = this.validateModel(request.model);
    const trigger = this.validateTrigger({
      type: request.trigger.type,
      cronExpression: request.trigger.cronExpression,
      timezone: request.trigger.timezone,
      isActive: request.trigger.isActive ?? true,
    });

    const created = this.automationDao.createWithTrigger({
      automation: {
        workspaceId: request.workspaceId,
        title,
        prompt,
        status,
        modelProviderId: model?.providerId ?? null,
        modelId: model?.modelId ?? null,
      },
      trigger,
    });
    this.refreshRegistration(created.id, created.status, created.trigger);
    this.emitChanged(created.id, "created");
    return this.toAutomationInfo(created);
  }

  /** createAutomation 工具的主进程实现：在当前工作空间创建并启用一条自动化。 */
  async createAutomationFromAgent(
    input: CreateAutomationToolInput,
    workspaceId: number,
  ): Promise<CreateAutomationToolResult> {
    try {
      const automation = this.createAutomation({
        workspaceId,
        title: input.title,
        prompt: input.prompt,
        model: input.model,
        trigger: {
          type: "schedule",
          cronExpression: input.cronExpression,
          timezone: input.timezone?.trim() || getSystemTimezone(),
          isActive: true,
        },
      });
      return {
        ok: true,
        automationId: automation.id,
        title: automation.title,
        cronExpression: automation.trigger.cronExpression,
      };
    } catch (error) {
      if (error instanceof AutomationValidationError) {
        return { ok: false, error: error.message };
      }
      console.error("Failed to create automation from agent:", error);
      return { ok: false, error: "创建定时任务失败，请稍后重试。" };
    }
  }

  /** 列出当前 Agent 工作空间的自动化，不暴露其他工作空间记录。 */
  async listAutomationsFromAgent(workspaceId: number): Promise<ListAutomationsToolResult> {
    try {
      this.validateWorkspace(workspaceId);
      return {
        ok: true,
        automations: this.automationDao.findWithTriggersByWorkspaceId(workspaceId).map((item) => ({
          automationId: item.id,
          title: item.title,
          prompt: item.prompt,
          status: item.status,
          cronExpression: item.trigger.cronExpression,
          timezone: item.trigger.timezone,
          model:
            item.modelProviderId && item.modelId
              ? { providerId: item.modelProviderId, modelId: item.modelId }
              : undefined,
        })),
      };
    } catch (error) {
      if (error instanceof AutomationValidationError) {
        return { ok: false, error: error.message };
      }
      console.error("Failed to list automations from agent:", error);
      return { ok: false, error: "读取自动化列表失败，请稍后重试。" };
    }
  }

  /** 修改当前 Agent 工作空间中的自动化。 */
  async updateAutomationFromAgent(
    input: UpdateAutomationToolInput,
    workspaceId: number,
  ): Promise<UpdateAutomationToolResult> {
    const existing = this.automationDao.findWithTriggerById(input.automationId);
    if (!existing || existing.workspaceId !== workspaceId) {
      return { ok: false, error: "当前工作空间中不存在该自动化。" };
    }

    try {
      const hasTriggerUpdate = input.cronExpression !== undefined || input.timezone !== undefined;
      const automation = this.updateAutomation({
        id: input.automationId,
        title: input.title,
        prompt: input.prompt,
        status: input.status,
        model: input.model,
        trigger: hasTriggerUpdate
          ? {
              cronExpression: input.cronExpression,
              timezone: input.timezone,
            }
          : undefined,
      });
      return {
        ok: true,
        automationId: automation.id,
        title: automation.title,
        status: automation.status,
        cronExpression: automation.trigger.cronExpression,
        timezone: automation.trigger.timezone,
      };
    } catch (error) {
      if (error instanceof AutomationValidationError) {
        return { ok: false, error: error.message };
      }
      if (error instanceof AutomationNotFoundError) {
        return { ok: false, error: "当前工作空间中不存在该自动化。" };
      }
      console.error("Failed to update automation from agent:", error);
      return { ok: false, error: "修改自动化失败，请稍后重试。" };
    }
  }

  /** 删除当前 Agent 工作空间中的自动化。 */
  async deleteAutomationFromAgent(
    input: DeleteAutomationToolInput,
    workspaceId: number,
  ): Promise<DeleteAutomationToolResult> {
    const existing = this.automationDao.findWithTriggerById(input.automationId);
    if (!existing || existing.workspaceId !== workspaceId) {
      return { ok: false, error: "当前工作空间中不存在该自动化。" };
    }

    try {
      this.deleteAutomation(input.automationId);
      return { ok: true, automationId: existing.id, title: existing.title };
    } catch (error) {
      if (error instanceof AutomationRunningConflictError) {
        return { ok: false, error: "自动化正在运行，暂时无法删除。" };
      }
      if (error instanceof AutomationNotFoundError) {
        return { ok: false, error: "当前工作空间中不存在该自动化。" };
      }
      console.error("Failed to delete automation from agent:", error);
      return { ok: false, error: "删除自动化失败，请稍后重试。" };
    }
  }

  updateAutomation(request: UpdateAutomationRequest): AutomationInfo {
    const existing = this.automationDao.findWithTriggerById(request.id);
    if (!existing) {
      throw new AutomationNotFoundError(request.id);
    }

    const workspaceId = this.validateWorkspace(request.workspaceId ?? existing.workspaceId);
    const prompt =
      request.prompt === undefined ? existing.prompt : this.validatePrompt(request.prompt);
    const title =
      request.title === undefined ? existing.title : this.buildTitle(request.title, prompt);
    const status = this.validateStatus(request.status ?? existing.status);
    const model: ModelConfig | undefined =
      request.model === undefined
        ? existing.modelProviderId && existing.modelId
          ? { providerId: existing.modelProviderId, modelId: existing.modelId }
          : undefined
        : this.validateModel(request.model ?? undefined);

    const triggerUpdate = request.trigger ?? {};
    const type = this.validateTriggerType(triggerUpdate.type ?? existing.trigger.type);
    const cronExpression = this.validateCron(
      triggerUpdate.cronExpression ?? existing.trigger.cronExpression,
    );
    const timezone = this.validateTimezone(triggerUpdate.timezone ?? existing.trigger.timezone);
    const isActive = triggerUpdate.isActive ?? existing.trigger.isActive;
    const trigger = { type, cronExpression, timezone, isActive };

    const updated = this.automationDao.update(request.id, {
      workspaceId,
      title,
      prompt,
      status,
      modelProviderId: model?.providerId ?? null,
      modelId: model?.modelId ?? null,
    });
    if (!updated) {
      throw new AutomationNotFoundError(request.id);
    }
    this.automationTriggerDao.update(request.id, trigger);
    this.refreshRegistration(request.id, status, trigger);
    this.emitChanged(request.id, "updated");
    return this.toAutomationInfo(this.automationDao.findWithTriggerById(request.id)!);
  }

  deleteAutomation(automationId: number): void {
    if (this.activeRuns.has(automationId)) {
      throw new AutomationRunningConflictError(automationId);
    }
    if (!this.automationDao.delete(automationId)) {
      throw new AutomationNotFoundError(automationId);
    }
    this.scheduler.unregister(automationId);
    this.emitChanged(automationId, "deleted");
  }

  /**
   * 立即执行：创建会话后立即返回运行中的 run（含 sessionId），消息在后台无人值守派发，
   * 便于前端直接跳转到正在执行的会话页面。运行收口与失败记录由后台任务完成。
   */
  async runAutomationNow(automationId: number): Promise<AutomationRunInfo> {
    const automation = this.automationDao.findWithTriggerById(automationId);
    if (!automation) {
      throw new AutomationNotFoundError(automationId);
    }
    if (automation.status !== "enabled") {
      throw new AutomationValidationError("自动化已停用，无法立即执行。");
    }
    let runId = 0;
    await this.withLock(automationId, async () => {
      if (this.activeRuns.has(automationId)) {
        throw new AutomationRunningConflictError(automationId);
      }
      const run = await this.executeRunSafely(automation, "manual", undefined, false);
      runId = run.id;
    });
    const started = this.automationRunDao.findByIdWithAgentSession(runId);
    if (!started) {
      throw new AutomationNotFoundError(automationId);
    }
    return this.toRunInfo(started, automation.workspaceId);
  }

  listAutomationRuns(
    automationId: number,
    options: { cursor?: number; limit?: number },
  ): ListAutomationRunsResponse {
    const automation = this.automationDao.findById(automationId);
    if (!automation) {
      throw new AutomationNotFoundError(automationId);
    }
    const limit = options.limit ?? RUN_HISTORY_DEFAULT_LIMIT;
    const rows = this.automationRunDao.listByAutomation(automationId, {
      cursor: options.cursor,
      limit: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      runs: page.map((run) => this.toRunInfo(run, automation.workspaceId)),
      nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
    };
  }

  /** cron 触发的入口；date 为本次触发的计划时间点。 */
  async handleScheduledTrigger(automationId: number, date: Date): Promise<void> {
    if (this.activeRuns.has(automationId)) {
      await this.recordSkipped(automationId, OVERLAP_MESSAGE, date);
      return;
    }
    await this.withLock(automationId, async () => {
      const automation = this.automationDao.findWithTriggerById(automationId);
      if (!automation) return;
      if (automation.status !== "enabled" || !automation.trigger.isActive) return;
      if (automation.lastScheduledAt && automation.lastScheduledAt.getTime() >= date.getTime()) {
        return;
      }
      if (this.activeRuns.has(automationId)) {
        await this.recordSkipped(automationId, OVERLAP_MESSAGE, date);
        return;
      }
      await this.executeRunSafely(automation, "scheduled", date);
    });
  }

  private async checkMissedRun(automation: AutomationWithTrigger): Promise<void> {
    const anchor = (automation.lastScheduledAt ?? automation.createdAt).getTime();
    const now = new Date();
    const expression = CronExpressionParser.parse(automation.trigger.cronExpression, {
      currentDate: now,
      tz: automation.trigger.timezone,
    });
    if (!expression.hasPrev()) return;
    const previous = expression.prev();
    if (previous.getTime() <= anchor) return;
    await this.executeRunSafely(automation, "catch_up", new Date(previous.getTime()));
  }

  private async executeRunSafely(
    automation: AutomationWithTrigger,
    kind: AutomationRunKind,
    scheduledFor: Date | undefined,
    awaitCompletion = true,
  ): Promise<import("../db/schema").AutomationRun> {
    this.activeRuns.add(automation.id);
    try {
      const { run, settled } = await this.executeRun(automation, kind, scheduledFor);
      if (!awaitCompletion) {
        // 立即执行立即返回；后台运行收口后再释放 activeRuns，保证调度互斥与删除保护仍然生效。
        void settled.finally(() => {
          this.activeRuns.delete(automation.id);
        });
        return run;
      }
      await settled;
      return run;
    } finally {
      if (awaitCompletion) {
        this.activeRuns.delete(automation.id);
      }
    }
  }

  private async executeRun(
    automation: AutomationWithTrigger,
    kind: AutomationRunKind,
    scheduledFor: Date | undefined,
  ): Promise<{
    run: import("../db/schema").AutomationRun;
    settled: Promise<void>;
  }> {
    const triggeredAt = new Date();
    if (kind !== "manual") {
      this.automationDao.update(automation.id, { lastScheduledAt: scheduledFor ?? undefined });
    }

    let model: ModelConfig;
    try {
      model = this.resolveModel(automation);
    } catch (error) {
      const failed = this.automationRunDao.create({
        automationId: automation.id,
        runKind: kind,
        status: "failed",
        scheduledFor: scheduledFor ?? null,
        triggeredAt,
        errorMessage: this.normalizeRunError(error),
      });
      this.automationDao.update(automation.id, { lastRunAt: triggeredAt });
      this.emitChanged(automation.id, "run-finished");
      return { run: failed, settled: Promise.resolve() };
    }

    const run = this.automationRunDao.create({
      automationId: automation.id,
      runKind: kind,
      status: "running",
      scheduledFor: scheduledFor ?? null,
      triggeredAt,
      errorMessage: null,
    });
    this.automationDao.update(automation.id, { lastRunAt: triggeredAt });
    this.emitChanged(automation.id, "run-started");

    try {
      const session = await this.sessionService.createSession(automation.workspaceId, {
        title: `[自动化] ${automation.title}`,
      });
      await this.automationRunDao.updateSessionId(run.id, session.databaseId);
      const settled = this.settleRun(automation, run, session.id, model);
      return { run, settled };
    } catch (error) {
      const finishedAt = new Date();
      this.automationRunDao.finish(run.id, {
        status: "failed",
        finishedAt,
        errorMessage: this.normalizeRunError(error),
      });
      this.emitChanged(automation.id, "run-finished");
      return { run, settled: Promise.resolve() };
    }
  }

  /** 派发无人值守消息并收口运行记录；返回的 promise 在运行真正结束后 resolve。 */
  private async settleRun(
    automation: AutomationWithTrigger,
    run: import("../db/schema").AutomationRun,
    sessionId: string,
    model: ModelConfig,
  ): Promise<void> {
    try {
      await this.messageService.sendMessage({
        workspaceId: automation.workspaceId,
        sessionId,
        content: automation.prompt,
        model,
        approvalMode: "delegate-approval",
        interactionMode: "unattended",
      });
      const finishedAt = new Date();
      this.automationRunDao.finish(run.id, { status: "completed", finishedAt, errorMessage: null });
      this.automationDao.update(automation.id, { lastCompletedAt: finishedAt });
      this.emitChanged(automation.id, "run-finished");
    } catch (error) {
      const finishedAt = new Date();
      this.automationRunDao.finish(run.id, {
        status: "failed",
        finishedAt,
        errorMessage: this.normalizeRunError(error),
      });
      this.emitChanged(automation.id, "run-finished");
    }
  }

  private async recordSkipped(
    automationId: number,
    reason: string,
    scheduledFor: Date,
  ): Promise<void> {
    this.automationRunDao.create({
      automationId,
      runKind: "scheduled",
      status: "skipped",
      scheduledFor,
      triggeredAt: new Date(),
      errorMessage: reason,
    });
    this.automationDao.update(automationId, { lastScheduledAt: scheduledFor });
    this.emitChanged(automationId, "run-finished");
  }

  private resolveModel(automation: Automation): ModelConfig {
    const providerId = automation.modelProviderId;
    const modelId = automation.modelId;
    if (providerId || modelId) {
      if (!providerId || !modelId) {
        throw new AutomationValidationError("自动化模型配置不完整，已跟随默认模型执行。");
      }
      this.agentService.getModel(providerId, modelId);
      return { providerId, modelId };
    }
    const defaultModel = this.userConfigService.getConfig().largeModel;
    if (!defaultModel) {
      throw new AutomationValidationError("未配置默认大模型，无法执行自动化。");
    }
    this.agentService.getModel(defaultModel.providerId, defaultModel.modelId);
    return defaultModel;
  }

  private normalizeRunError(error: unknown): string {
    if (error instanceof UnattendedInteractionError) {
      return error.message;
    }
    if (error instanceof AutomationValidationError || error instanceof AutomationNotFoundError) {
      return error.message;
    }
    return GENERIC_RUN_ERROR;
  }

  private computeNextRunAt(automation: Automation, trigger: AutomationTrigger): Date | undefined {
    if (automation.status !== "enabled" || !trigger.isActive) return undefined;
    try {
      const expression = CronExpressionParser.parse(trigger.cronExpression, {
        currentDate: new Date(),
        tz: trigger.timezone,
      });
      return expression.hasNext() ? new Date(expression.next().getTime()) : undefined;
    } catch {
      return undefined;
    }
  }

  private registerAutomation(automationId: number): void {
    const automation = this.automationDao.findWithTriggerById(automationId);
    if (!automation || automation.status !== "enabled" || !automation.trigger.isActive) return;
    this.scheduler.register(
      automation.id,
      automation.trigger.cronExpression,
      automation.trigger.timezone,
      (date) => {
        void this.handleScheduledTrigger(automation.id, date);
      },
    );
  }

  private refreshRegistration(
    automationId: number,
    status: AutomationStatus,
    trigger: Pick<AutomationTrigger, "type" | "cronExpression" | "timezone" | "isActive">,
  ): void {
    if (status === "enabled" && trigger.isActive) {
      this.scheduler.register(automationId, trigger.cronExpression, trigger.timezone, (date) => {
        void this.handleScheduledTrigger(automationId, date);
      });
    } else {
      this.scheduler.unregister(automationId);
    }
  }

  private emitChanged(
    automationId: number,
    type: "created" | "updated" | "deleted" | "run-started" | "run-finished",
  ): void {
    this.eventService.sendEvent(AUTOMATION_CHANGED_EVENT, { automationId, type });
  }

  private withLock<T>(automationId: number, operation: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(automationId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.locks.set(automationId, tail);
    return previous
      .catch(() => undefined)
      .then(() => operation())
      .finally(() => {
        release();
        if (this.locks.get(automationId) === tail) {
          this.locks.delete(automationId);
        }
      });
  }

  private validateWorkspace(workspaceId: number): number {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      throw new AutomationValidationError("工作空间无效。");
    }
    if (!this.workspaceDao.findById(workspaceId)) {
      throw new AutomationValidationError("工作空间不存在。");
    }
    return workspaceId;
  }

  private validatePrompt(prompt: string): string {
    const trimmed = prompt.trim();
    if (!trimmed) {
      throw new AutomationValidationError("提示词不能为空。");
    }
    return trimmed;
  }

  private buildTitle(title: string | undefined, prompt: string): string {
    if (title !== undefined && title.trim() !== "") {
      return title.trim();
    }
    const compressed = prompt.replace(/\s+/g, " ").trim();
    return compressed.slice(0, TITLE_MAX_LENGTH) || TITLE_FALLBACK;
  }

  private validateStatus(status: AutomationStatus): AutomationStatus {
    if (status !== "enabled" && status !== "disabled") {
      throw new AutomationValidationError("自动化状态无效。");
    }
    return status;
  }

  private validateModel(model: ModelConfig | undefined): ModelConfig | undefined {
    if (!model) return undefined;
    if (
      typeof model.providerId !== "string" ||
      model.providerId.trim() === "" ||
      typeof model.modelId !== "string" ||
      model.modelId.trim() === ""
    ) {
      throw new AutomationValidationError("模型配置无效。");
    }
    try {
      this.agentService.getModel(model.providerId, model.modelId);
    } catch {
      throw new AutomationValidationError("模型不可用，请重新选择。");
    }
    return model;
  }

  private validateTriggerType(type: AutomationTriggerType): AutomationTriggerType {
    if (type !== "schedule") {
      throw new AutomationValidationError("触发器类型无效。");
    }
    return type;
  }

  private validateCron(expression: string): string {
    const trimmed = expression.trim();
    if (trimmed.split(/\s+/).length !== 5) {
      throw new AutomationValidationError("cron 表达式必须为 5 段。");
    }
    if (!cron.validate(trimmed)) {
      throw new AutomationValidationError("cron 表达式无效。");
    }
    try {
      CronExpressionParser.parse(trimmed);
    } catch {
      throw new AutomationValidationError("cron 表达式无效。");
    }
    return trimmed;
  }

  private validateTimezone(timezone: string): string {
    const trimmed = timezone.trim();
    if (!trimmed) {
      throw new AutomationValidationError("时区无效。");
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    } catch {
      throw new AutomationValidationError("时区无效。");
    }
    return trimmed;
  }

  private validateTrigger(input: {
    type: AutomationTriggerType;
    cronExpression: string;
    timezone: string;
    isActive: boolean;
  }) {
    return {
      type: this.validateTriggerType(input.type),
      cronExpression: this.validateCron(input.cronExpression),
      timezone: this.validateTimezone(input.timezone),
      isActive: input.isActive,
    };
  }

  private toAutomationInfo(automation: AutomationWithTrigger): AutomationInfo {
    return {
      id: automation.id,
      workspaceId: automation.workspaceId,
      title: automation.title,
      prompt: automation.prompt,
      status: automation.status,
      model:
        automation.modelProviderId && automation.modelId
          ? { providerId: automation.modelProviderId, modelId: automation.modelId }
          : undefined,
      lastScheduledAt: automation.lastScheduledAt ?? undefined,
      lastRunAt: automation.lastRunAt ?? undefined,
      lastCompletedAt: automation.lastCompletedAt ?? undefined,
      createdAt: automation.createdAt,
      updatedAt: automation.updatedAt,
      trigger: {
        id: automation.trigger.id,
        automationId: automation.trigger.automationId,
        type: automation.trigger.type,
        cronExpression: automation.trigger.cronExpression,
        timezone: automation.trigger.timezone,
        isActive: automation.trigger.isActive,
        createdAt: automation.trigger.createdAt,
        updatedAt: automation.trigger.updatedAt,
      },
    };
  }

  private toRunInfo(
    run: import("../db/schema").AutomationRun & { agentSessionId: string | null },
    workspaceId: number,
  ): AutomationRunInfo {
    return {
      id: run.id,
      automationId: run.automationId,
      workspaceId,
      sessionId: run.agentSessionId ?? undefined,
      runKind: run.runKind,
      status: run.status,
      scheduledFor: run.scheduledFor ?? undefined,
      triggeredAt: run.triggeredAt,
      finishedAt: run.finishedAt ?? undefined,
      errorMessage: run.errorMessage ?? undefined,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  }
}
