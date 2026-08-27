import { randomUUID } from "node:crypto";
import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import type {
  AgentMode,
  AiApprovalReview,
  ModelConfig,
  PermissionMode,
  ToolApprovalDecision,
  ToolApprovalEventPayload,
} from "@shared/api";
import { TOOL_APPROVAL_EVENT, TOOL_APPROVAL_RESOLVED_EVENT } from "@shared/constants";
import type { ToolApprovalRequest } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { EventService } from "./event.service";
import { SessionService } from "./session.service";

const TOOL_APPROVAL_ENTRY = "willow.tool-approval";

export type ToolApprovalRecoveryContext = {
  agentMode?: AgentMode;
  model: ModelConfig;
  permissionMode: PermissionMode;
  userMessage: string;
};

export type PersistedToolApproval = ToolApprovalRecoveryContext & {
  payload: ToolApprovalEventPayload;
};

type ToolApprovalEntryData =
  | {
      version: 1;
      type: "requested";
      approval: PersistedToolApproval;
    }
  | {
      version: 1;
      type: "decided";
      approvalId: string;
      decision: ToolApprovalDecision;
    };

export type ToolApprovalResolution = {
  approval: PersistedToolApproval;
  live: boolean;
};

type PendingApproval = {
  approval: PersistedToolApproval;
  resolve: (decision: ToolApprovalDecision) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
};

@Injectable()
export class ToolApprovalService {
  private readonly pending = new Map<string, PendingApproval>();
  private readonly queue: string[] = [];
  private readonly resolving = new Set<string>();
  private readonly persistenceQueues = new Map<string, Promise<void>>();
  private readonly approvalLocations = new Map<
    string,
    { workspaceId: number; sessionId: string }
  >();
  private activeApprovalId?: string;

  constructor(
    private readonly eventService: EventService,
    private readonly sessionService: SessionService,
  ) {}

  async request(
    workspaceId: number,
    sessionId: string,
    request: ToolApprovalRequest,
    recovery: ToolApprovalRecoveryContext,
    signal?: AbortSignal,
    aiReview?: AiApprovalReview,
  ): Promise<ToolApprovalDecision> {
    if (signal?.aborted) return "deny";
    const approvalId = randomUUID();
    const payload = immutable({
      ...structuredClone(request),
      approvalId,
      workspaceId,
      sessionId,
      aiReview,
    }) as ToolApprovalEventPayload;
    const approval: PersistedToolApproval = { ...recovery, payload };
    this.approvalLocations.set(approvalId, { workspaceId, sessionId });
    try {
      await this.appendEntry(workspaceId, sessionId, {
        version: 1,
        type: "requested",
        approval,
      });
    } catch (error) {
      this.approvalLocations.delete(approvalId);
      throw error;
    }
    if (signal?.aborted) {
      await this.appendDecision(workspaceId, sessionId, approvalId, "deny");
      return "deny";
    }

    return new Promise<ToolApprovalDecision>((resolve) => {
      const item: PendingApproval = { approval, resolve, signal };
      this.pending.set(approvalId, item);
      this.queue.push(approvalId);
      if (signal) {
        item.onAbort = () => {
          void this.resolve(workspaceId, sessionId, approvalId, "deny").catch(() => {
            this.settle(approvalId, "deny");
          });
        };
        signal.addEventListener("abort", item.onAbort, { once: true });
        if (signal.aborted) {
          item.onAbort();
          return;
        }
      }
      this.dispatchNext();
    });
  }

  async resolve(
    workspaceId: number,
    sessionId: string,
    approvalId: string,
    decision: ToolApprovalDecision,
    mode: "live" | "recovered" = "live",
  ): Promise<ToolApprovalResolution | undefined> {
    if (this.resolving.has(approvalId)) return undefined;
    this.resolving.add(approvalId);
    try {
      const approvals = await this.getPendingApprovals(workspaceId, sessionId);
      const approval = approvals.find((candidate) => candidate.payload.approvalId === approvalId);
      if (!approval) return undefined;
      const hasPendingRequest = this.pending.has(approvalId);
      const live = mode === "live" && hasPendingRequest;
      await this.appendDecision(workspaceId, sessionId, approvalId, decision);
      this.approvalLocations.delete(approvalId);
      if (hasPendingRequest) this.settle(approvalId, decision);
      return { approval, live };
    } finally {
      this.resolving.delete(approvalId);
    }
  }

  async getPendingApproval(
    workspaceId: number,
    sessionId: string,
  ): Promise<PersistedToolApproval | undefined> {
    return (await this.getPendingApprovals(workspaceId, sessionId))[0];
  }

  locate(approvalId: string): { workspaceId: number; sessionId: string } | undefined {
    return this.approvalLocations.get(approvalId);
  }

  private async getPendingApprovals(
    workspaceId: number,
    sessionId: string,
  ): Promise<PersistedToolApproval[]> {
    const branch = await this.sessionService.getBranch(workspaceId, sessionId);
    const pending = new Map<string, PersistedToolApproval>();
    for (const entry of branch) {
      const data = this.parseEntry(entry);
      if (!data) continue;
      if (data.type === "requested") {
        pending.set(data.approval.payload.approvalId, data.approval);
        this.approvalLocations.set(data.approval.payload.approvalId, {
          workspaceId,
          sessionId,
        });
      } else {
        pending.delete(data.approvalId);
        this.approvalLocations.delete(data.approvalId);
      }
    }
    return [...pending.values()];
  }

  private settle(approvalId: string, decision: ToolApprovalDecision): void {
    const item = this.pending.get(approvalId);
    if (!item) return;
    this.pending.delete(approvalId);
    if (item.signal && item.onAbort) {
      item.signal.removeEventListener("abort", item.onAbort);
    }
    const queueIndex = this.queue.indexOf(approvalId);
    if (queueIndex >= 0) this.queue.splice(queueIndex, 1);
    if (this.activeApprovalId === approvalId) this.activeApprovalId = undefined;
    this.eventService.sendEvent(TOOL_APPROVAL_RESOLVED_EVENT, {
      approvalId,
      workspaceId: item.approval.payload.workspaceId,
      sessionId: item.approval.payload.sessionId,
    });
    item.resolve(decision);
    this.dispatchNext();
  }

  private dispatchNext(): void {
    if (this.activeApprovalId) return;
    const approvalId = this.queue[0];
    if (!approvalId) return;
    const item = this.pending.get(approvalId);
    if (!item) {
      this.queue.shift();
      this.dispatchNext();
      return;
    }
    this.activeApprovalId = approvalId;
    this.eventService.sendEvent(TOOL_APPROVAL_EVENT, item.approval.payload);
  }

  private appendDecision(
    workspaceId: number,
    sessionId: string,
    approvalId: string,
    decision: ToolApprovalDecision,
  ): Promise<string> {
    return this.appendEntry(workspaceId, sessionId, {
      version: 1,
      type: "decided",
      approvalId,
      decision,
    });
  }

  private appendEntry(
    workspaceId: number,
    sessionId: string,
    data: ToolApprovalEntryData,
  ): Promise<string> {
    const key = `${workspaceId}:${sessionId}`;
    const previous = this.persistenceQueues.get(key) ?? Promise.resolve();
    const operation = previous.then(() =>
      this.sessionService.appendCustomEntry(workspaceId, sessionId, TOOL_APPROVAL_ENTRY, data),
    );
    const tail = operation.then(
      () => undefined,
      () => undefined,
    );
    this.persistenceQueues.set(key, tail);
    void tail.finally(() => {
      if (this.persistenceQueues.get(key) === tail) this.persistenceQueues.delete(key);
    });
    return operation;
  }

  private parseEntry(entry: SessionTreeEntry): ToolApprovalEntryData | undefined {
    if (
      entry.type !== "custom" ||
      entry.customType !== TOOL_APPROVAL_ENTRY ||
      !entry.data ||
      typeof entry.data !== "object"
    ) {
      return undefined;
    }
    const data = entry.data as Partial<ToolApprovalEntryData>;
    if (data.version !== 1 || (data.type !== "requested" && data.type !== "decided")) {
      return undefined;
    }
    return data as ToolApprovalEntryData;
  }
}

function immutable<T extends object>(value: T): Readonly<T> {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") immutable(nested as object);
  }
  return Object.freeze(value);
}
