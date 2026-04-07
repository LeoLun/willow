import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ActiveSessionStream, ToolApproval } from "@shared/api";
import { reactive, onMounted, onUnmounted, type Ref, watch } from "vue";
import { electronAPI } from "@/lib/ipc";
import { useEventBus } from "./useEventBus";

interface AgentMessagesState {
  messages: AgentMessage[];
  streamMessage: AgentMessage | null;
  isStreaming: boolean;
  tools: any[];
  pendingToolCalls: Set<string>;
  toolApprovals: Map<string, ToolApproval>;
}

interface UpdateMessagePayload {
  sessionId: number;
  groupId: string;
  event: {
    type: string;
    message?: AgentMessage;
    messages?: AgentMessage[];
    assistantMessageEvent?: any;
    toolCallId?: string;
    toolName?: string;
    args?: any;
    partialResult?: any;
    result?: any;
    isError?: boolean;
    toolResults?: any[];
    approval?: ToolApproval;
  };
}

export interface UseAgentMessagesOptions {
  onActiveStreamLoaded?: (activeStream: ActiveSessionStream) => void;
}

export function useAgentMessages(sessionId: Ref<number>, options?: UseAgentMessagesOptions) {
  const state = reactive<AgentMessagesState>({
    messages: [],
    streamMessage: null,
    isStreaming: false,
    tools: [],
    pendingToolCalls: new Set(),
    toolApprovals: new Map(),
  });

  const { addEventListener, removeEventListener } = useEventBus();

  function resetState() {
    state.messages = [];
    state.streamMessage = null;
    state.isStreaming = false;
    state.tools = [];
    state.pendingToolCalls = new Set();
    state.toolApprovals = new Map();
  }

  function applyActiveStream(activeStream?: ActiveSessionStream) {
    if (!activeStream) {
      return;
    }
    state.messages = activeStream.messages ?? [];
    state.streamMessage = activeStream.streamMessage ?? null;
    state.isStreaming = activeStream.isStreaming ?? false;
    state.pendingToolCalls = new Set(activeStream.pendingToolCallIds ?? []);
    state.toolApprovals = new Map(
      (activeStream.toolApprovals ?? []).map((approval) => [approval.toolCallId, approval]),
    );
  }

  function handleUpdateMessage(data: UpdateMessagePayload) {
    if (data.sessionId !== sessionId.value) return;
    const event = data.event;
    switch (event.type) {
      case "agent_start":
        state.isStreaming = true;
        state.streamMessage = null;
        break;

      case "message_start":
      case "message_update":
        state.streamMessage = event.message ?? null;
        break;

      case "message_end":
        state.streamMessage = null;
        if (event.message) {
          state.messages = [...state.messages, event.message];
        }
        break;

      case "agent_end":
        state.isStreaming = false;
        state.streamMessage = null;
        // 与主进程一致：须为完整会话（主进程已将 agent_end 的 messages 补全为 agent.state.messages）
        if (event.messages) {
          state.messages = event.messages;
        }
        break;

      case "tool_execution_start":
      case "tool_execution_update":
        if (event.toolCallId) {
          state.pendingToolCalls = new Set([...state.pendingToolCalls, event.toolCallId]);
        }
        break;

      case "tool_execution_end":
        if (event.toolCallId) {
          const next = new Set(state.pendingToolCalls);
          next.delete(event.toolCallId);
          state.pendingToolCalls = next;
        }
        break;

      case "tool_approval_update":
        if (event.approval) {
          const next = new Map(state.toolApprovals);
          next.set(event.approval.toolCallId, event.approval);
          state.toolApprovals = next;
        }
        break;

      case "turn_start":
      case "turn_end":
        break;
    }
  }

  onMounted(() => {
    addEventListener("UPDATE_MESSAGE", handleUpdateMessage);
  });

  onUnmounted(() => {
    removeEventListener("UPDATE_MESSAGE", handleUpdateMessage);
  });

  watch(
    sessionId,
    async (id) => {
      resetState();
      if (!id || Number.isNaN(id)) {
        return;
      }
      try {
        const data = await electronAPI.getSessionHistory({ sessionId: id });
        if (id !== sessionId.value) {
          return;
        }
        if (data?.activeStream) {
          applyActiveStream(data.activeStream);
          options?.onActiveStreamLoaded?.(data.activeStream);
          return;
        }
        // 如果是空数组，则不进行初始化
        if (data?.messages?.length === 0) {
          return;
        }
        state.messages = data?.messages ?? [];
      } catch (e) {
        console.error("getSessionHistory failed", e);
      }
    },
    { immediate: true },
  );

  return { state };
}
