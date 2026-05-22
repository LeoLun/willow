<script setup lang="ts">
import { AskUserPanel, PermissionApprovalPanel, MarkdownBlock } from "@willow/ui";
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from "vue";
import BallStreaming from "./BallStreaming.vue";

// IPC types
interface AskUserApproval {
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  title: string;
  status: "pending" | "approved" | "rejected";
}

interface ToolApproval {
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  title: string;
  reason: string;
  risk: "medium" | "high";
  status: "pending" | "approved" | "rejected";
}

const isStreaming = ref(false);
const streamMessage = ref<any>(null);
const toolApprovals = ref<Map<string, any>>(new Map());
const sessionId = ref<number | null>(null);

const windowPos = ref({ x: 0, y: 0 });
let offsetX = 0;
let offsetY = 0;
let mouseDownOnBall = false;
let movedDuringDrag = false;
const isMounted = ref(false);

// Active approval and askUser computed states
const pendingAskUser = computed<AskUserApproval | undefined>(() =>
  Array.from(toolApprovals.value.values()).find(
    (a) => a.toolName === "ask_user" && a.status === "pending",
  ),
);

const pendingApproval = computed<ToolApproval | undefined>(() =>
  Array.from(toolApprovals.value.values()).find(
    (a) => a.status === "pending" && a.toolName !== "ask_user",
  ),
);

// Stream content parsing
const lastChunk = computed(() => {
  if (!streamMessage.value || !Array.isArray(streamMessage.value.content)) {
    return null;
  }
  const content = streamMessage.value.content;
  for (let i = content.length - 1; i >= 0; i--) {
    const chunk = content[i];
    if (chunk.type === "text" && chunk.text && chunk.text.trim()) {
      return { type: "text", text: chunk.text };
    }
    if (chunk.type === "thinking" && chunk.thinking && chunk.thinking.trim()) {
      return { type: "thinking", text: chunk.thinking };
    }
    if (chunk.type === "toolCall" && chunk.name) {
      return { type: "toolCall", name: chunk.name, id: chunk.id };
    }
  }
  return null;
});

// Cache content to persist during turn transitions or short delays
const lastDisplayContent = ref<{ type: string; text?: string; name?: string; id?: string } | null>(
  null,
);
watch(lastChunk, (newChunk) => {
  if (newChunk) {
    lastDisplayContent.value = newChunk;
  }
});

const scrollContainer = ref<HTMLDivElement | null>(null);

const scrollToBottom = () => {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
    }
  });
};

watch(
  () => [
    lastDisplayContent.value?.text,
    lastDisplayContent.value?.type,
    lastDisplayContent.value?.name,
    pendingAskUser.value,
    pendingApproval.value,
  ],
  () => {
    scrollToBottom();
  },
  { deep: true },
);

// Cooldown / collapse logic
const showLUI = ref(false);
const isHovered = ref(false);
let closeTimer: NodeJS.Timeout | null = null;

function handleMouseEnter() {
  isHovered.value = true;
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function handleMouseLeave() {
  isHovered.value = false;
  startCloseTimerIfNeeded();
}

function startCloseTimerIfNeeded() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (!isStreaming.value && !pendingAskUser.value && !pendingApproval.value && !isHovered.value) {
    closeTimer = setTimeout(() => {
      showLUI.value = false;
      closeTimer = null;
    }, 4000);
  }
}

watch(
  [isStreaming, pendingAskUser, pendingApproval],
  ([streaming, askUser, approval]) => {
    if (streaming || askUser || approval) {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      showLUI.value = true;
    } else {
      startCloseTimerIfNeeded();
    }
  },
  { immediate: true },
);

// Window size and focus calculations
const windowSize = computed(() => {
  if (!showLUI.value) {
    return { width: 80, height: 80, focusable: false };
  }
  if (pendingAskUser.value || pendingApproval.value) {
    return { width: 350, height: 230, focusable: true };
  }
  if (lastDisplayContent.value) {
    return { width: 280, height: 180, focusable: false };
  }
  return { width: 80, height: 80, focusable: false };
});

const cardContainerClass = computed(() => {
  if (pendingAskUser.value || pendingApproval.value) {
    return "w-full";
  }
  return "w-fit min-w-[100px] max-w-[250px]";
});

const isLeftExpand = ref(true);

watch(
  () => windowPos.value.x,
  (newX) => {
    if (windowSize.value.width === 80) {
      const screenWidth = window.screen.availWidth;
      const screenLeft = window.screen.availLeft || 0;
      const centerX = screenLeft + screenWidth / 2;
      const ballCenterX = newX + 40;
      isLeftExpand.value = ballCenterX < centerX;
    }
  },
  { immediate: true },
);

const lastResizedSize = { width: 0, height: 0, focusable: false };

watch(
  windowSize,
  async (size) => {
    if (!isMounted.value) return;
    if (
      size.width === lastResizedSize.width &&
      size.height === lastResizedSize.height &&
      size.focusable === lastResizedSize.focusable
    ) {
      return;
    }
    lastResizedSize.width = size.width;
    lastResizedSize.height = size.height;
    lastResizedSize.focusable = size.focusable;

    try {
      const pos = await window.electronAPI.resizeFloatingBallWindow({
        width: size.width,
        height: size.height,
        focusable: size.focusable,
        isLeft: isLeftExpand.value,
      });
      if (pos && !mouseDownOnBall) {
        windowPos.value = pos;
      }
    } catch (err) {
      console.error("Failed to resize window", err);
    }
  },
  { deep: true },
);

// Event Handler for Notice Bus
function handleEvent(eventName: string, data: any) {
  if (eventName === "UPDATE_MESSAGE" && data?.chatScope === "conversation") {
    const event = data?.event;
    if (!event) return;

    // Track active sessionId
    if (data.sessionId) {
      sessionId.value = data.sessionId;
    }

    switch (event.type) {
      case "agent_start":
        isStreaming.value = true;
        streamMessage.value = null;
        lastDisplayContent.value = null;
        break;
      case "agent_end":
        isStreaming.value = false;
        streamMessage.value = null;
        break;
      case "message_start":
      case "message_update":
        streamMessage.value = event.message ?? null;
        break;
      case "message_end":
        streamMessage.value = null;
        break;
      case "tool_approval_update":
        if (event.approval) {
          toolApprovals.value.set(event.approval.toolCallId, event.approval);
        }
        break;
    }
  }
}

// Load active session on startup to restore state
async function loadActiveSession() {
  try {
    const res = await window.electronAPI.getConversationSession();
    if (res?.sessionId) {
      sessionId.value = res.sessionId;
      const history = await window.electronAPI.getSessionHistory({ sessionId: res.sessionId });
      if (history?.activeStream) {
        isStreaming.value = history.activeStream.isStreaming ?? false;
        if (history.activeStream.toolApprovals) {
          toolApprovals.value = new Map(
            history.activeStream.toolApprovals.map((a) => [a.toolCallId, a]),
          );
        }
        if (history.activeStream.streamMessage) {
          streamMessage.value = history.activeStream.streamMessage;
        }
      }
    }
  } catch (err) {
    console.error("Failed to restore session history", err);
  }
}

onMounted(async () => {
  window.electronAPI.registerEvent({}, handleEvent);

  const { config } = await window.electronAPI.getFloatingBallConfig();
  if (config.x >= 0 && config.y >= 0) {
    windowPos.value = { x: config.x, y: config.y };
  }

  await loadActiveSession();
  isMounted.value = true;
});

// Dragging controls
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch (err) {
    console.error("setPointerCapture failed", err);
  }
  mouseDownOnBall = true;
  movedDuringDrag = false;
  offsetX = e.screenX - windowPos.value.x;
  offsetY = e.screenY - windowPos.value.y;
}

function onPointerMove(e: PointerEvent) {
  if (!mouseDownOnBall) return;
  movedDuringDrag = true;
  const x = Math.round(e.screenX - offsetX);
  const y = Math.round(e.screenY - offsetY);
  windowPos.value = { x, y };
  window.electronAPI.moveFloatingBallWindow({ x, y });
}

async function onPointerUp(e: PointerEvent) {
  if (!mouseDownOnBall) return;
  mouseDownOnBall = false;

  if (e.button !== 0) return;

  if (movedDuringDrag) {
    const screenWidth = window.screen.availWidth;
    const screenLeft = window.screen.availLeft || 0;
    const centerX = screenLeft + screenWidth / 2;
    const ballCenterX = Math.round(
      windowPos.value.x + (isLeftExpand.value ? 40 : windowSize.value.width - 40),
    );
    const finalIsLeft = ballCenterX < centerX;

    let saveX = Math.round(ballCenterX - 40);
    let saveY = Math.round(windowPos.value.y);
    if (windowSize.value.height > 80) {
      saveY = Math.round(windowPos.value.y + windowSize.value.height - 80);
    }

    await window.electronAPI.setFloatingBallPosition({
      x: saveX,
      y: saveY,
    });

    if (windowSize.value.width > 80 && finalIsLeft !== isLeftExpand.value) {
      isLeftExpand.value = finalIsLeft;
      const newWindowX = Math.round(finalIsLeft ? ballCenterX - 40 : ballCenterX - 380);
      windowPos.value.x = newWindowX;
      await window.electronAPI.moveFloatingBallWindow({
        x: newWindowX,
        y: Math.round(windowPos.value.y),
      });
    }
  }
}

window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);

onUnmounted(() => {
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
});

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  window.electronAPI.showFloatingBallMenu();
}

function onClick(e: MouseEvent) {
  if (e.button !== 0) return;
  if (movedDuringDrag) {
    movedDuringDrag = false;
    return;
  }
  window.electronAPI.showMainWindow();
}

// Action handlers
async function handleResolveAskUser(decision: "approved" | "rejected", answer?: string) {
  const approval = pendingAskUser.value;
  if (!approval || !sessionId.value) return;

  await window.electronAPI.resolveToolApproval({
    sessionId: sessionId.value,
    toolCallId: approval.toolCallId,
    decision,
    reason: answer,
  });

  toolApprovals.value.delete(approval.toolCallId);
}

async function handleApprove(toolCallId: string) {
  if (!sessionId.value) return;
  await window.electronAPI.resolveToolApproval({
    sessionId: sessionId.value,
    toolCallId,
    decision: "approved",
  });
  toolApprovals.value.delete(toolCallId);
}

async function handleReject(toolCallId: string, reason?: string) {
  if (!sessionId.value) return;
  await window.electronAPI.resolveToolApproval({
    sessionId: sessionId.value,
    toolCallId,
    decision: "rejected",
    reason,
  });
  toolApprovals.value.delete(toolCallId);
}

async function handleSkip() {
  const approval = pendingApproval.value;
  if (!approval || !sessionId.value) return;

  await window.electronAPI.resolveToolApproval({
    sessionId: sessionId.value,
    toolCallId: approval.toolCallId,
    decision: "rejected",
  });
  toolApprovals.value.delete(approval.toolCallId);

  await window.electronAPI.stopSessionStream({
    sessionId: sessionId.value,
  });
}

function handleCloseLUI() {
  showLUI.value = false;
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function getFriendlyToolName(name: string): string {
  const mapping: Record<string, string> = {
    write_to_file: "正在写入文件",
    replace_file_content: "正在修改文件",
    multi_replace_file_content: "正在修改文件",
    run_command: "正在运行终端命令",
    ask_permission: "正在申请权限",
    askUser: "正在等待用户确认",
    view_file: "正在读取文件内容",
    list_dir: "正在读取目录结构",
    grep_search: "正在搜索代码库",
    search_web: "正在搜索网页",
  };
  return mapping[name] || `正在调用工具 ${name}`;
}
</script>

<template>
  <div
    class="floating-ball-container dark flex h-screen w-screen flex-col-reverse overflow-hidden bg-transparent select-none"
    :class="[
      isLeftExpand ? 'items-start' : 'items-end',
      pendingAskUser || pendingApproval ? 'p-[12px]' : 'p-[15px]',
    ]"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- The Ball -->
    <div
      class="no-drag-region flex h-[50px] w-[50px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/90 shadow-lg transition-all hover:scale-105 active:scale-95"
      @pointerdown="onPointerDown"
      @contextmenu="onContextMenu"
      @click.left="onClick"
    >
      <BallStreaming :streaming="isStreaming" />
    </div>

    <!-- The LUI Card -->
    <div
      v-if="showLUI && (lastDisplayContent || pendingAskUser || pendingApproval)"
      class="no-drag-region mb-3 flex min-h-0 w-full flex-1 flex-col justify-end"
      :class="isLeftExpand ? 'items-start' : 'items-end'"
    >
      <!-- Glassmorphic Card Container -->
      <div
        ref="scrollContainer"
        class="no-scrollbar max-h-full overflow-y-auto text-white"
        :class="[
          pendingAskUser || pendingApproval
            ? 'w-full border-none bg-transparent p-0 backdrop-blur-none'
            : 'rounded-2xl border border-white/10 bg-black/85 p-4 shadow-2xl backdrop-blur-xl ' +
              cardContainerClass,
        ]"
      >
        <!-- Interactive Panels -->
        <div v-if="pendingAskUser" class="w-full text-foreground">
          <AskUserPanel
            :approval="pendingAskUser"
            :compact="true"
            @resolve="handleResolveAskUser"
            @close="handleCloseLUI"
          />
        </div>
        <div v-else-if="pendingApproval" class="w-full text-foreground">
          <PermissionApprovalPanel
            :approvals="[pendingApproval]"
            :compact="true"
            @approve="handleApprove"
            @reject="handleReject"
            @skip="handleSkip"
            @close="handleCloseLUI"
          />
        </div>
        <!-- Streaming Output -->
        <div v-else-if="lastDisplayContent" class="flex min-w-0 flex-col gap-1.5">
          <div
            class="flex items-center justify-between text-[11px] font-medium tracking-wider text-white/40 uppercase"
          >
            <span>
              {{
                lastDisplayContent.type === "thinking"
                  ? "AI 正在思考"
                  : lastDisplayContent.type === "toolCall"
                    ? "正在执行"
                    : "AI 正在输出"
              }}
            </span>
            <span class="size-1.5 animate-pulse rounded-full bg-emerald-500"></span>
          </div>

          <div class="min-w-0 text-[13px] leading-relaxed font-normal text-white/90">
            <div v-if="lastDisplayContent.type === 'thinking'">
              <MarkdownBlock :content="lastDisplayContent.text || ''" :is-thinking="true" />
            </div>
            <div
              v-else-if="lastDisplayContent.type === 'toolCall'"
              class="font-medium text-blue-400"
            >
              {{ getFriendlyToolName(lastDisplayContent.name || "") }}
            </div>
            <div v-else>
              <MarkdownBlock :content="lastDisplayContent.text || ''" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
