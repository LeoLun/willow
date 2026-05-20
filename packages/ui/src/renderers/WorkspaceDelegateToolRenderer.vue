<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { CheckCircle2, XCircle, Loader2, ChevronRight } from "lucide-vue-next";
import { computed, ref, watch, onUnmounted } from "vue";
import { i18n } from "../utils/i18n";

interface DelegateDetails {
  childSessionId: number;
  workspaceId: number;
  workspaceName: string;
  agentName: string;
  status: "completed" | "stopped" | "failed";
  summary: string;
}

const props = defineProps<{
  params?: unknown;
  result?: ToolResultMessage<DelegateDetails>;
  isStreaming?: boolean;
  onNavigateToSession?: (childSessionId: number) => void | Promise<void>;
  onGetSessionHistory?: (sessionId: number) => Promise<any>;
  onSubscribeSessionUpdate?: (sessionId: number, callback: (event: any) => void) => () => void;
}>();

const parsedParams = computed<Record<string, unknown>>(() => {
  if (!props.params) return {};
  if (typeof props.params === "object") return props.params as Record<string, unknown>;
  if (typeof props.params === "string") {
    try {
      const parsed = JSON.parse(props.params);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
});

const details = computed(() => props.result?.details);

const state = computed(() => {
  if (props.result) return props.result.isError ? "error" : "completed";
  return props.isStreaming ? "running" : "pending";
});

const workspaceName = computed(() => {
  const fromResult = details.value?.workspaceName?.trim();
  if (fromResult) return fromResult;
  const fromParams = parsedParams.value.workspaceName;
  if (typeof fromParams === "string" && fromParams.trim()) return fromParams.trim();
  const fromParamsId = parsedParams.value.workspaceId;
  return fromParamsId ? `工作空间 #${fromParamsId}` : "工作空间";
});

const agentName = computed(() => {
  const fromResult = details.value?.agentName?.trim();
  if (fromResult) return fromResult;
  const fromParams = parsedParams.value.agentName;
  return typeof fromParams === "string" && fromParams.trim() ? fromParams.trim() : "Agent";
});

const titleText = computed(() => `委派「${workspaceName.value} / ${agentName.value}」`);

const delegateStatus = computed(() => {
  if (state.value === "error") return "failed";
  return details.value?.status ?? "running";
});

const childSessionId = computed(() => {
  const fromResult = details.value?.childSessionId;
  if (fromResult) return fromResult;
  const fromParams = parsedParams.value.childSessionId;
  return typeof fromParams === "number" ? fromParams : undefined;
});

// 实时状态订阅逻辑
const childIsStreaming = ref(false);
const childLastStepText = ref("");
let unsubscribeSession: (() => void) | null = null;

function cleanup() {
  if (unsubscribeSession) {
    unsubscribeSession();
    unsubscribeSession = null;
  }
}

onUnmounted(() => {
  cleanup();
});

function updateStepTextFromToolName(toolName: string) {
  const toolMap: Record<string, string> = {
    read: "读取文件",
    write: "写入文件",
    edit: "修改文件",
    find: "搜索文件",
    grep: "搜索内容",
    ls: "列出目录",
    web_fetch: "获取网页",
    web_search: "搜索网页",
    bash: "执行终端命令",
    workspace_delegate: "委派子 Agent",
  };
  const name = toolMap[toolName] || toolName;
  childLastStepText.value = `正在运行工具: ${name}`;
}

function updateStepFromActiveStream(activeStream: any) {
  if (!activeStream) return;
  const messages = activeStream.messages ?? [];
  const streamMsg = activeStream.streamMessage;
  const pendingToolCallIds = activeStream.pendingToolCallIds ?? [];

  // 1. 如果有正在运行的 tool call
  if (pendingToolCallIds && pendingToolCallIds.length > 0) {
    const lastMsg = streamMsg || messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "assistant" && Array.isArray(lastMsg.content)) {
      const activeTc = lastMsg.content.find(
        (part: any) => part.type === "toolCall" && pendingToolCallIds.includes(part.id),
      );
      if (activeTc) {
        updateStepTextFromToolName(activeTc.name);
        return;
      }
    }
  }

  // 2. 否则，判断是否在思考或回复
  const lastMsg = streamMsg || messages[messages.length - 1];
  if (lastMsg && lastMsg.role === "assistant" && Array.isArray(lastMsg.content)) {
    const lastPart = lastMsg.content[lastMsg.content.length - 1];
    if (lastPart) {
      if (lastPart.type === "thinking") {
        childLastStepText.value = "正在思考...";
        return;
      }
      if (lastPart.type === "text") {
        childLastStepText.value = "正在回复...";
        return;
      }
    }
  }

  childLastStepText.value = childIsStreaming.value ? "正在处理..." : "";
}

function handleChildSessionEvent(event: any) {
  if (!event) return;
  switch (event.type) {
    case "agent_start":
      childIsStreaming.value = true;
      childLastStepText.value = "正在思考...";
      break;

    case "agent_end":
      childIsStreaming.value = false;
      childLastStepText.value = "";
      break;

    case "message_start":
      childLastStepText.value = "正在思考...";
      break;

    case "message_update":
      if (event.message && Array.isArray(event.message.content)) {
        const content = event.message.content;
        const lastPart = content[content.length - 1];
        if (lastPart) {
          if (lastPart.type === "thinking") {
            childLastStepText.value = "正在思考...";
          } else if (lastPart.type === "text") {
            childLastStepText.value = "正在回复...";
          }
        }
      }
      break;

    case "tool_execution_start":
    case "tool_execution_update":
      if (event.toolName) {
        updateStepTextFromToolName(event.toolName);
      } else {
        childLastStepText.value = "正在执行工具...";
      }
      break;

    case "tool_execution_end":
      childLastStepText.value = "正在处理...";
      break;
  }
}

watch(
  () => childSessionId.value,
  async (id) => {
    cleanup();
    childIsStreaming.value = false;
    childLastStepText.value = "";

    if (!id) return;

    // 1. 获取初始状态
    if (props.onGetSessionHistory) {
      try {
        const history = await props.onGetSessionHistory(id);
        if (history) {
          const activeStream = history.activeStream;
          if (activeStream) {
            childIsStreaming.value = activeStream.isStreaming ?? false;
            updateStepFromActiveStream(activeStream);
          } else {
            childIsStreaming.value = false;
            childLastStepText.value = "";
          }
        }
      } catch (e) {
        console.error("Failed to fetch child session history:", e);
      }
    }

    // 2. 订阅实时更新
    if (props.onSubscribeSessionUpdate) {
      unsubscribeSession = props.onSubscribeSessionUpdate(id, (event) => {
        handleChildSessionEvent(event);
      });
    }
  },
  { immediate: true },
);

const isRunning = computed(() => {
  return state.value === "running" || delegateStatus.value === "running" || childIsStreaming.value;
});

const isFailed = computed(() => {
  return state.value === "error" || delegateStatus.value === "failed";
});

const isCompleted = computed(() => {
  return (
    !isRunning.value &&
    !isFailed.value &&
    (state.value === "completed" || delegateStatus.value === "completed")
  );
});

const displayStatusText = computed(() => {
  if (isFailed.value) return "委派执行已失败";
  if (isCompleted.value) return "委派执行已完成";
  if (delegateStatus.value === "stopped") return "委派执行已停止";
  if (isRunning.value) {
    return childLastStepText.value || "正在委派执行中...";
  }
  return "等待委派执行...";
});

async function navigateToChildSession() {
  if (childSessionId.value) {
    await props.onNavigateToSession?.(childSessionId.value);
  }
}
</script>

<template>
  <div
    class="group relative flex items-center justify-between rounded-lg border border-border/40 bg-card/30 p-3 transition-all duration-200"
    :class="[
      childSessionId ? 'cursor-pointer hover:bg-muted/30' : 'cursor-default',
      isFailed ? 'border-destructive/30 bg-destructive/5' : '',
    ]"
    @click="childSessionId && navigateToChildSession()"
  >
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <!-- Status Indicator -->
      <div class="flex shrink-0 items-center justify-center">
        <Loader2 v-if="isRunning" class="size-4 animate-spin text-primary" />
        <CheckCircle2 v-else-if="isCompleted" class="size-4 text-emerald-500" />
        <XCircle v-else-if="isFailed" class="size-4 text-destructive" />
        <Loader2 v-else class="size-4 text-muted-foreground" />
      </div>

      <!-- Content -->
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <!-- Title -->
        <span
          class="truncate text-sm leading-5 font-medium transition-colors"
          :class="isCompleted ? 'text-muted-foreground' : 'text-foreground'"
        >
          {{ titleText }}
        </span>
        <!-- Status / Execution details -->
        <span class="truncate text-xs text-muted-foreground">
          {{ displayStatusText }}
        </span>
      </div>
    </div>

    <!-- Navigate Arrow -->
    <div
      v-if="childSessionId"
      class="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-muted/50 hover:text-foreground"
    >
      <ChevronRight class="size-4" />
    </div>
  </div>
</template>
