import type { ToolPermissionRisk } from "./create-tool";

export type ToolApprovalStatus = "pending" | "approved" | "rejected";
export type ToolApprovalDecision = "approved" | "rejected";

export interface ToolApprovalRequest {
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  title: string;
  reason: string;
  risk: ToolPermissionRisk;
  status: ToolApprovalStatus;
}

type ToolApprovalListener = (approval: ToolApprovalRequest) => void;

interface PendingToolApproval {
  approval: ToolApprovalRequest;
  resolve: (decision: ToolApprovalDecision, reason?: string) => void;
}

export class ToolApprovalCoordinator {
  private readonly pending = new Map<string, PendingToolApproval>();
  private readonly pendingListeners = new Set<ToolApprovalListener>();
  private readonly resolvedListeners = new Set<ToolApprovalListener>();

  onPending(listener: ToolApprovalListener): () => void {
    this.pendingListeners.add(listener);
    return () => this.pendingListeners.delete(listener);
  }

  onResolved(listener: ToolApprovalListener): () => void {
    this.resolvedListeners.add(listener);
    return () => this.resolvedListeners.delete(listener);
  }

  async requestApproval(
    approval: Omit<ToolApprovalRequest, "status">,
    signal?: AbortSignal,
  ): Promise<{ decision: ToolApprovalDecision; reason?: string }> {
    const pendingApproval: ToolApprovalRequest = { ...approval, status: "pending" };

    return new Promise<{ decision: ToolApprovalDecision; reason?: string }>((resolve) => {
      const cleanupAbort = () => {
        signal?.removeEventListener("abort", onAbort);
      };

      const finalize = (decision: ToolApprovalDecision, reason?: string) => {
        cleanupAbort();
        this.pending.delete(approval.toolCallId);
        this.emitResolved({
          ...pendingApproval,
          status: decision,
        });
        resolve({ decision, reason });
      };

      const onAbort = () => {
        if (!this.pending.has(approval.toolCallId)) return;
        finalize("rejected");
      };

      this.pending.set(approval.toolCallId, {
        approval: pendingApproval,
        resolve: finalize,
      });
      signal?.addEventListener("abort", onAbort, { once: true });
      this.emitPending(pendingApproval);
    });
  }

  resolve(toolCallId: string, decision: ToolApprovalDecision, reason?: string): boolean {
    const pendingApproval = this.pending.get(toolCallId);
    if (!pendingApproval) {
      return false;
    }

    pendingApproval.resolve(decision, reason);
    return true;
  }

  private emitPending(approval: ToolApprovalRequest) {
    for (const listener of this.pendingListeners) {
      listener(approval);
    }
  }

  private emitResolved(approval: ToolApprovalRequest) {
    for (const listener of this.resolvedListeners) {
      listener(approval);
    }
  }
}
