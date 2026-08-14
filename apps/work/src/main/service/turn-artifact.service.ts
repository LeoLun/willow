import type { AgentMessage, SessionTreeEntry } from "@earendil-works/pi-agent-core";
import type {
  TurnArtifactBundle,
  TurnFileArtifact,
  TurnFileArtifactStatus,
  TurnPlanArtifact,
} from "@shared/api";
import { Injectable } from "@willow/poetry";
import { SessionService } from "./session.service";

export const TURN_ARTIFACT_ENTRY = "willow.turn-artifacts.v1";

type PlanCall = { content: string; toolCallId: string };
type PlanResult = Omit<TurnPlanArtifact, "content"> & { toolCallId: string };
type FileResult = TurnFileArtifact & { toolCallId: string };

export class TurnArtifactCapture {
  private completed = false;
  private readonly initialToolResultIds = new Set<string>();
  private readonly fileResults = new Map<string, FileResult>();
  private readonly planCalls = new Map<string, PlanCall>();
  private readonly planResults = new Map<string, PlanResult>();
  private lastAssistantTimestamp?: number;

  constructor(
    private readonly service: TurnArtifactService,
    private readonly workspaceId: number,
    private readonly sessionId: string,
    branch: readonly SessionTreeEntry[],
  ) {
    for (const entry of branch) {
      if (entry.type !== "message") continue;
      const message = asRecord(entry.message);
      if (message.role === "assistant") this.recordAssistant(message);
      if (message.role === "toolResult" && typeof message.toolCallId === "string") {
        this.initialToolResultIds.add(message.toolCallId);
      }
    }
  }

  recordMessage(message: AgentMessage | unknown): void {
    const value = asRecord(message);
    if (value.role === "assistant") {
      this.recordAssistant(value);
      return;
    }
    if (
      value.role !== "toolResult" ||
      typeof value.toolCallId !== "string" ||
      this.initialToolResultIds.has(value.toolCallId) ||
      value.isError === true
    ) {
      return;
    }

    const details = asRecord(value.details);
    if (value.toolName === "write" && details.kind === "write") {
      this.recordWriteResult(value.toolCallId, details);
    } else if (value.toolName === "edit" && details.kind === "edit") {
      this.recordEditResult(value.toolCallId, details);
    } else if (
      (value.toolName === "writePlan" && details.kind === "writePlan") ||
      (value.toolName === "updatePlan" && details.kind === "updatePlan")
    ) {
      this.recordPlanResult(value.toolCallId, details);
    }
  }

  async complete(
    assistantTimestamp = this.lastAssistantTimestamp,
  ): Promise<TurnArtifactBundle | undefined> {
    if (this.completed) return undefined;
    this.completed = true;
    if (assistantTimestamp === undefined) return undefined;
    const files = this.getFiles();
    const plans = this.getPlans();
    if (files.length === 0 && plans.length === 0) return undefined;
    const artifact: TurnArtifactBundle = {
      assistantTimestamp,
      files,
      plans,
      version: 1,
    };
    await this.service.persist(this.workspaceId, this.sessionId, artifact);
    return artifact;
  }

  async dispose(): Promise<void> {
    this.completed = true;
  }

  private recordAssistant(message: Record<string, unknown>): void {
    if (typeof message.timestamp === "number") this.lastAssistantTimestamp = message.timestamp;
    if (!Array.isArray(message.content)) return;
    for (const item of message.content) {
      const content = asRecord(item);
      if (
        content.type !== "toolCall" ||
        (content.name !== "writePlan" && content.name !== "updatePlan")
      ) {
        continue;
      }
      const input = asRecord(content.arguments);
      if (typeof content.id !== "string" || typeof input.content !== "string") continue;
      this.planCalls.set(content.id, { content: input.content, toolCallId: content.id });
    }
  }

  private recordWriteResult(toolCallId: string, details: Record<string, unknown>): void {
    if (
      typeof details.path !== "string" ||
      typeof details.created !== "boolean" ||
      !isNonNegativeNumber(details.addedLines) ||
      !isNonNegativeNumber(details.removedLines)
    ) {
      return;
    }
    this.fileResults.set(toolCallId, {
      additions: details.addedLines,
      deletions: details.removedLines,
      path: details.path,
      status: details.created ? "added" : "modified",
      toolCallId,
    });
  }

  private recordEditResult(toolCallId: string, details: Record<string, unknown>): void {
    if (
      typeof details.path !== "string" ||
      !isNonNegativeNumber(details.addedLines) ||
      !isNonNegativeNumber(details.removedLines)
    ) {
      return;
    }
    this.fileResults.set(toolCallId, {
      additions: details.addedLines,
      deletions: details.removedLines,
      path: details.path,
      status: "modified",
      toolCallId,
    });
  }

  private recordPlanResult(toolCallId: string, details: Record<string, unknown>): void {
    if (
      typeof details.path !== "string" ||
      typeof details.fileName !== "string" ||
      !isNonNegativeNumber(details.lineCount) ||
      !isNonNegativeNumber(details.byteCount)
    ) {
      return;
    }
    this.planResults.set(toolCallId, {
      byteCount: details.byteCount,
      fileName: details.fileName,
      lineCount: details.lineCount,
      path: details.path,
      toolCallId,
    });
  }

  private getFiles(): TurnFileArtifact[] {
    const files = new Map<string, TurnFileArtifact>();
    for (const result of this.fileResults.values()) {
      const current = files.get(result.path);
      files.set(result.path, {
        additions: (current?.additions ?? 0) + (result.additions ?? 0),
        deletions: (current?.deletions ?? 0) + (result.deletions ?? 0),
        path: result.path,
        status: current?.status === "added" || result.status === "added" ? "added" : "modified",
      });
    }
    return [...files.values()];
  }

  private getPlans(): TurnPlanArtifact[] {
    const plans: TurnPlanArtifact[] = [];
    for (const result of this.planResults.values()) {
      const call = this.planCalls.get(result.toolCallId);
      if (!call) continue;
      plans.push({
        byteCount: result.byteCount,
        content: call.content,
        fileName: result.fileName,
        lineCount: result.lineCount,
        path: result.path,
      });
    }
    return plans;
  }
}

@Injectable()
export class TurnArtifactService {
  constructor(private readonly sessionService: SessionService) {}

  begin(
    workspaceId: number,
    sessionId: string,
    branch: readonly SessionTreeEntry[],
  ): TurnArtifactCapture {
    return new TurnArtifactCapture(this, workspaceId, sessionId, branch);
  }

  getArtifacts(branch: readonly SessionTreeEntry[]): TurnArtifactBundle[] {
    return branch.flatMap((entry) => {
      if (entry.type !== "custom" || entry.customType !== TURN_ARTIFACT_ENTRY) return [];
      const artifact = parseArtifact(entry.data);
      return artifact ? [artifact] : [];
    });
  }

  async persist(
    workspaceId: number,
    sessionId: string,
    artifact: TurnArtifactBundle,
  ): Promise<void> {
    await this.sessionService.appendCustomEntry(
      workspaceId,
      sessionId,
      TURN_ARTIFACT_ENTRY,
      artifact,
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function parseArtifact(value: unknown): TurnArtifactBundle | undefined {
  const artifact = asRecord(value);
  if (
    artifact.version !== 1 ||
    !isNonNegativeNumber(artifact.assistantTimestamp) ||
    !Array.isArray(artifact.files) ||
    !Array.isArray(artifact.plans)
  ) {
    return undefined;
  }

  const files = artifact.files.map(parseFileArtifact);
  const plans = artifact.plans.map(parsePlanArtifact);
  if (files.some((file) => file === undefined) || plans.some((plan) => plan === undefined)) {
    return undefined;
  }
  return {
    assistantTimestamp: artifact.assistantTimestamp,
    files: files as TurnFileArtifact[],
    plans: plans as TurnPlanArtifact[],
    version: 1,
  };
}

function parseFileArtifact(value: unknown): TurnFileArtifact | undefined {
  const file = asRecord(value);
  const statuses: readonly TurnFileArtifactStatus[] = ["added", "modified", "deleted", "renamed"];
  if (
    typeof file.path !== "string" ||
    !statuses.includes(file.status as TurnFileArtifactStatus) ||
    (file.oldPath !== undefined && typeof file.oldPath !== "string") ||
    (file.additions !== undefined && !isNonNegativeNumber(file.additions)) ||
    (file.deletions !== undefined && !isNonNegativeNumber(file.deletions))
  ) {
    return undefined;
  }
  return {
    ...(typeof file.additions === "number" ? { additions: file.additions } : {}),
    ...(typeof file.deletions === "number" ? { deletions: file.deletions } : {}),
    ...(typeof file.oldPath === "string" ? { oldPath: file.oldPath } : {}),
    path: file.path,
    status: file.status as TurnFileArtifactStatus,
  };
}

function parsePlanArtifact(value: unknown): TurnPlanArtifact | undefined {
  const plan = asRecord(value);
  if (
    typeof plan.path !== "string" ||
    typeof plan.fileName !== "string" ||
    typeof plan.content !== "string" ||
    !isNonNegativeNumber(plan.lineCount) ||
    !isNonNegativeNumber(plan.byteCount)
  ) {
    return undefined;
  }
  return {
    byteCount: plan.byteCount,
    content: plan.content,
    fileName: plan.fileName,
    lineCount: plan.lineCount,
    path: plan.path,
  };
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
