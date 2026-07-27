import type { ToolApprovalDecision, ToolApprovalEventPayload } from "@shared/api";
import { TOOL_APPROVAL_EVENT } from "@shared/constants";
import { createGlobalState } from "@vueuse/core";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  toValue,
  type MaybeRefOrGetter,
} from "vue";
import { electronAPI } from "@/lib/ipc";
import { useEventBus } from "./useEventBus";

const useToolApprovalState = createGlobalState(() => {
  const approvals = shallowRef<ReadonlyMap<string, ToolApprovalEventPayload>>(new Map());
  const revisions = new Map<string, number>();

  function handleApprovalRequested(payload: ToolApprovalEventPayload): void {
    setApproval(payload.workspaceId, payload.sessionId, payload);
  }

  function setApproval(
    workspaceId: number,
    sessionId: string,
    approval?: ToolApprovalEventPayload,
  ): void {
    const next = new Map(approvals.value);
    const key = approvalKey(workspaceId, sessionId);
    if (approval) {
      next.set(key, approval);
    } else {
      next.delete(key);
    }
    approvals.value = next;
    revisions.set(key, (revisions.get(key) ?? 0) + 1);
  }

  function getRevision(workspaceId: number, sessionId: string): number {
    return revisions.get(approvalKey(workspaceId, sessionId)) ?? 0;
  }

  function hydrateApproval(
    workspaceId: number,
    sessionId: string,
    approval: ToolApprovalEventPayload | undefined,
    expectedRevision: number,
  ): boolean {
    if (getRevision(workspaceId, sessionId) !== expectedRevision) return false;
    setApproval(workspaceId, sessionId, approval);
    return true;
  }

  async function resolveApproval(
    approvalId: string,
    decision: ToolApprovalDecision,
  ): Promise<void> {
    const approval = [...approvals.value.values()].find(
      (candidate) => candidate.approvalId === approvalId,
    );
    if (!approval) throw new Error("审批请求已失效");
    const response = await electronAPI.resolveToolApproval({
      approvalId,
      workspaceId: approval.workspaceId,
      sessionId: approval.sessionId,
      decision,
    });
    if (!response.resolved) throw new Error("审批请求已失效");
    if (
      approvals.value.get(approvalKey(approval.workspaceId, approval.sessionId))?.approvalId ===
      approvalId
    ) {
      setApproval(approval.workspaceId, approval.sessionId);
    }
  }

  return {
    approvals,
    getRevision,
    handleApprovalRequested,
    hydrateApproval,
    resolveApproval,
    setApproval,
  };
});

function approvalKey(workspaceId: number, sessionId: string): string {
  return `${workspaceId}:${sessionId}`;
}

export function hydrateToolApproval(
  workspaceId: number,
  sessionId: string,
  approval?: ToolApprovalEventPayload,
  expectedRevision = getToolApprovalRevision(workspaceId, sessionId),
): boolean {
  return useToolApprovalState().hydrateApproval(workspaceId, sessionId, approval, expectedRevision);
}

export function getToolApprovalRevision(workspaceId: number, sessionId: string): number {
  return useToolApprovalState().getRevision(workspaceId, sessionId);
}

export function useToolApprovalListener(): void {
  const { handleApprovalRequested } = useToolApprovalState();
  const { addEventListener, removeEventListener, waitUntilReady } = useEventBus();

  onMounted(() => {
    addEventListener(TOOL_APPROVAL_EVENT, handleApprovalRequested);
    void waitUntilReady().catch((error) => {
      console.error("订阅工具审批事件失败:", error);
    });
  });

  onBeforeUnmount(() => {
    removeEventListener(TOOL_APPROVAL_EVENT, handleApprovalRequested);
  });
}

export function useToolApproval(
  workspaceId: MaybeRefOrGetter<number | undefined>,
  sessionId: MaybeRefOrGetter<string | undefined>,
) {
  const { approvals, resolveApproval } = useToolApprovalState();
  const currentApproval = computed(() => {
    const currentWorkspaceId = toValue(workspaceId);
    const currentSessionId = toValue(sessionId);
    if (currentWorkspaceId === undefined || currentSessionId === undefined) return undefined;
    return approvals.value.get(approvalKey(currentWorkspaceId, currentSessionId));
  });

  return {
    currentApproval,
    resolveApproval,
  };
}
