<script setup lang="ts">
import { Play, Square, Activity, HelpCircle, ShieldAlert, Check } from "lucide-vue-next";
import { ref, onBeforeMount, onBeforeUnmount } from "vue";
import FloatingBall from "../../../../work/src/renderer-floating-ball/FloatingBall.vue";

// Simulated Electron state
const simX = ref(360);
const simY = ref(380);
const simWidth = ref(80);
const simHeight = ref(80);
const simFocusable = ref(false);

// Active listeners and console logs
const listeners = ref<Array<(eventName: string, data: any) => void>>([]);
const actionLogs = ref<Array<{ time: string; msg: string }>>([]);

function logAction(msg: string) {
  const time = new Date().toTimeString().split(" ")[0];
  actionLogs.value.unshift({ time, msg });
  if (actionLogs.value.length > 15) {
    actionLogs.value.pop();
  }
}

function clearLogs() {
  actionLogs.value = [];
}

// Notice Bus dispatch helper
function broadcastEvent(eventName: string, data: any) {
  logAction(`NoticeBus dispatch: ${eventName} - ${JSON.stringify(data.event || data)}`);
  listeners.value.forEach((handler) => {
    try {
      handler(eventName, data);
    } catch (err) {
      console.error("NoticeBus dispatch failed", err);
    }
  });
}

// Screen property mocking
let restoreScreen: () => void = () => {};

// Electron API Mocking
let originalElectronAPI: any = null;

onBeforeMount(() => {
  // Mock window.screen properties
  try {
    const availWidthProp = Object.getOwnPropertyDescriptor(Screen.prototype, "availWidth");
    const availLeftProp = Object.getOwnPropertyDescriptor(Screen.prototype, "availLeft");

    Object.defineProperty(window.screen, "availWidth", { get: () => 800, configurable: true });
    Object.defineProperty(window.screen, "availLeft", { get: () => 0, configurable: true });

    restoreScreen = () => {
      if (availWidthProp) Object.defineProperty(Screen.prototype, "availWidth", availWidthProp);
      if (availLeftProp) Object.defineProperty(Screen.prototype, "availLeft", availLeftProp);
    };
  } catch (e) {
    const origScreen = window.screen;
    Object.defineProperty(window, "screen", {
      get: () => ({
        availWidth: 800,
        availHeight: 500,
        availLeft: 0,
        availTop: 0,
        width: 800,
        height: 500,
      }),
      configurable: true,
    });
    restoreScreen = () => {
      Object.defineProperty(window, "screen", {
        get: () => origScreen,
        configurable: true,
      });
    };
  }

  // Mock window.electronAPI
  originalElectronAPI = (window as any).electronAPI;
  (window as any).electronAPI = {
    registerEvent: (opts: any, handler: any) => {
      listeners.value.push(handler);
      logAction("electronAPI.registerEvent called");
    },
    getFloatingBallConfig: async () => {
      logAction("electronAPI.getFloatingBallConfig query");
      return { config: { x: simX.value, y: simY.value } };
    },
    getConversationSession: async () => {
      logAction("electronAPI.getConversationSession query");
      return { sessionId: 42 };
    },
    getSessionHistory: async () => {
      logAction("electronAPI.getSessionHistory query");
      return { activeStream: null };
    },
    resizeFloatingBallWindow: async ({ width, height, focusable, isLeft }: any) => {
      const oldW = simWidth.value;
      const oldH = simHeight.value;
      const finalIsLeft = typeof isLeft === "boolean" ? isLeft : simX.value + oldW / 2 < 400;

      let newX = finalIsLeft ? simX.value : simX.value + oldW - width;
      let newY = simY.value + oldH - height;

      // Clamp values within simulated screen boundaries [800x500]
      newX = Math.max(0, Math.min(800 - width, newX));
      newY = Math.max(0, Math.min(500 - height, newY));

      simX.value = Math.round(newX);
      simY.value = Math.round(newY);
      simWidth.value = Math.round(width);
      simHeight.value = Math.round(height);
      if (typeof focusable === "boolean") {
        simFocusable.value = focusable;
      }

      logAction(
        `electronAPI.resizeFloatingBallWindow: ${width}x${height}, isLeft=${isLeft} -> set bounds x=${simX.value}, y=${simY.value}`,
      );
      return { x: simX.value, y: simY.value };
    },
    moveFloatingBallWindow: async ({ x, y }: any) => {
      // Allow moving but clamp to keep ball visible in mock desktop container
      simX.value = Math.max(0, Math.min(800 - simWidth.value, x));
      simY.value = Math.max(0, Math.min(500 - simHeight.value, y));
      logAction(`electronAPI.moveFloatingBallWindow: (${simX.value}, ${simY.value})`);
    },
    setFloatingBallPosition: async ({ x, y }: any) => {
      simX.value = Math.max(0, Math.min(800 - 80, x));
      simY.value = Math.max(0, Math.min(500 - 80, y));
      logAction(`electronAPI.setFloatingBallPosition: (${simX.value}, ${simY.value})`);
    },
    resolveToolApproval: async (data: any) => {
      logAction(`electronAPI.resolveToolApproval: ${JSON.stringify(data)}`);
    },
    stopSessionStream: async (data: any) => {
      logAction(`electronAPI.stopSessionStream: ${JSON.stringify(data)}`);
    },
    showFloatingBallMenu: () => {
      logAction("electronAPI.showFloatingBallMenu triggered");
    },
    showMainWindow: () => {
      logAction("electronAPI.showMainWindow triggered");
    },
  };
});

onBeforeUnmount(() => {
  restoreScreen();
  if (originalElectronAPI) {
    (window as any).electronAPI = originalElectronAPI;
  } else {
    delete (window as any).electronAPI;
  }
});

// Control States
const streamingActive = ref(false);
const streamType = ref<"thinking" | "text" | "toolCall">("text");
const streamText = ref(
  "这是一条测试流式输出的内容，支持在悬浮球 LUI 展开面板中自适应换行与优雅的细节排版。",
);
const selectedTool = ref("write_to_file");

const permissionTool = ref("run_command");
const permissionTitle = ref("正在运行终端命令");
const permissionRisk = ref<"medium" | "high">("medium");

const askUserQuestion = ref("需要使用哪个组件库作为样式基础？");
const askUserOptions = ref("Vanilla CSS, Tailwind CSS, UnoCSS");

// Mock Actions
function toggleStreaming() {
  streamingActive.value = !streamingActive.value;
  if (streamingActive.value) {
    broadcastEvent("UPDATE_MESSAGE", {
      chatScope: "conversation",
      sessionId: 42,
      event: { type: "agent_start" },
    });
    broadcastEvent("UPDATE_MESSAGE", {
      chatScope: "conversation",
      sessionId: 42,
      event: { type: "message_start" },
    });
    // Send initial content
    sendStreamingContent();
  } else {
    broadcastEvent("UPDATE_MESSAGE", {
      chatScope: "conversation",
      sessionId: 42,
      event: { type: "message_end" },
    });
    broadcastEvent("UPDATE_MESSAGE", {
      chatScope: "conversation",
      sessionId: 42,
      event: { type: "agent_end" },
    });
  }
}

function sendStreamingContent() {
  if (!streamingActive.value) return;

  let contentItem: any = {};
  if (streamType.value === "thinking") {
    contentItem = { type: "thinking", thinking: streamText.value };
  } else if (streamType.value === "text") {
    contentItem = { type: "text", text: streamText.value };
  } else if (streamType.value === "toolCall") {
    contentItem = { type: "toolCall", name: selectedTool.value, id: "mock_call_" + Date.now() };
  }

  broadcastEvent("UPDATE_MESSAGE", {
    chatScope: "conversation",
    sessionId: 42,
    event: {
      type: "message_update",
      message: {
        content: [contentItem],
      },
    },
  });
}

function requestPermission() {
  broadcastEvent("UPDATE_MESSAGE", {
    chatScope: "conversation",
    sessionId: 42,
    event: {
      type: "tool_approval_update",
      approval: {
        toolCallId: "perm_" + Date.now(),
        toolName: permissionTool.value,
        arguments:
          permissionTool.value === "run_command"
            ? "pnpm build && pnpm lint"
            : '{\n  "TargetFile": "/Users/liujinglun/code/willow/vite.config.ts"\n}',
        title: permissionTitle.value,
        risk: permissionRisk.value,
        status: "pending",
      },
    },
  });
}

function requestAskUser() {
  const optionsArr = askUserOptions.value
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  broadcastEvent("UPDATE_MESSAGE", {
    chatScope: "conversation",
    sessionId: 42,
    event: {
      type: "tool_approval_update",
      approval: {
        toolCallId: "ask_" + Date.now(),
        toolName: "ask_user",
        arguments: {
          question: askUserQuestion.value,
          options: optionsArr,
        },
        title: askUserQuestion.value,
        status: "pending",
      },
    },
  });
}
</script>

<template>
  <div class="flex h-full w-full overflow-hidden bg-zinc-950 font-sans text-zinc-100">
    <!-- Left panel: Debug Tools & Actions -->
    <div
      class="flex w-[360px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-zinc-800 bg-zinc-900/60 p-5"
    >
      <div>
        <div class="flex items-center justify-between">
          <h2 class="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <Activity class="size-5 text-indigo-400" />
            悬浮球 LUI 调试面板
          </h2>
        </div>
        <div class="mt-1">
          <a
            href="#/"
            class="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
          >
            ← 返回主调试页面
          </a>
        </div>
        <p class="mt-2 text-xs text-zinc-400">
          在此页模拟 Electron 环境，测试窗口坐标防溢出计算、多态展开卡片及事件广播效果。
        </p>
      </div>

      <hr class="border-zinc-800" />

      <!-- Section: Stream Emulation -->
      <div class="space-y-4">
        <h3 class="text-sm font-semibold text-zinc-300">1. 流式输出状态</h3>

        <div class="flex items-center justify-between">
          <span class="text-xs text-zinc-400">当前流式渲染：</span>
          <button
            @click="toggleStreaming"
            class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            :class="
              streamingActive
                ? 'border border-red-500/30 bg-red-500/20 text-red-400'
                : 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
            "
          >
            <component :is="streamingActive ? Square : Play" class="size-3.5" />
            {{ streamingActive ? "结束流式状态" : "开启流式状态" }}
          </button>
        </div>

        <div class="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <div class="flex flex-col gap-1">
            <label class="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase"
              >类型</label
            >
            <select
              v-model="streamType"
              :disabled="!streamingActive"
              class="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none disabled:opacity-50"
              @change="sendStreamingContent"
            >
              <option value="thinking">Thinking (思考中)</option>
              <option value="text">Text (普通文本)</option>
              <option value="toolCall">Tool Call (正在执行工具)</option>
            </select>
          </div>

          <div
            v-if="streamType === 'thinking' || streamType === 'text'"
            class="flex flex-col gap-1"
          >
            <label class="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase"
              >流式文本内容</label
            >
            <textarea
              v-model="streamText"
              :disabled="!streamingActive"
              class="h-16 w-full rounded border border-zinc-800 bg-zinc-900 p-1.5 font-mono text-xs text-zinc-300 outline-none disabled:opacity-50"
              @input="sendStreamingContent"
            ></textarea>
          </div>

          <div v-if="streamType === 'toolCall'" class="flex flex-col gap-1">
            <label class="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase"
              >正在调用的工具</label
            >
            <select
              v-model="selectedTool"
              :disabled="!streamingActive"
              class="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none disabled:opacity-50"
              @change="sendStreamingContent"
            >
              <option value="write_to_file">write_to_file</option>
              <option value="run_command">run_command</option>
              <option value="replace_file_content">replace_file_content</option>
              <option value="search_web">search_web</option>
              <option value="grep_search">grep_search</option>
            </select>
          </div>
        </div>
      </div>

      <hr class="border-zinc-800" />

      <!-- Section: Interactive Panels -->
      <div class="space-y-4">
        <h3 class="text-sm font-semibold text-zinc-300">2. 模拟工具调用审批</h3>

        <!-- Tool Approval -->
        <div class="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <h4 class="flex items-center gap-1 text-xs font-semibold text-indigo-400">
            <ShieldAlert class="size-3.5" />
            权限申请 (PermissionApproval)
          </h4>

          <div class="flex flex-col gap-1.5">
            <select
              v-model="permissionTool"
              class="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none"
            >
              <option value="run_command">run_command (命令执行)</option>
              <option value="write_to_file">write_to_file (写入文件)</option>
            </select>
            <input
              v-model="permissionTitle"
              placeholder="面板显示标题"
              class="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none"
            />
            <div class="mt-1 flex items-center justify-between text-xs">
              <span class="text-zinc-400">风险等级:</span>
              <div class="flex gap-2">
                <label class="flex items-center gap-1 text-[11px]">
                  <input type="radio" value="medium" v-model="permissionRisk" /> 中
                </label>
                <label class="flex items-center gap-1 text-[11px]">
                  <input type="radio" value="high" v-model="permissionRisk" /> 高
                </label>
              </div>
            </div>
          </div>

          <button
            @click="requestPermission"
            class="mt-2 w-full rounded bg-indigo-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
          >
            发送权限审批请求
          </button>
        </div>

        <!-- Ask User -->
        <div class="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <h4 class="flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <HelpCircle class="size-3.5" />
            提问与答复 (AskUser)
          </h4>

          <div class="flex flex-col gap-1.5">
            <input
              v-model="askUserQuestion"
              placeholder="提问的标题"
              class="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none"
            />
            <input
              v-model="askUserOptions"
              placeholder="选项 (逗号隔开)"
              class="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none"
            />
          </div>

          <button
            @click="requestAskUser"
            class="mt-2 w-full rounded bg-emerald-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
          >
            发送提问交互请求
          </button>
        </div>
      </div>

      <hr class="border-zinc-800" />

      <!-- Section: IPC & Action Log -->
      <div class="flex min-h-[160px] flex-1 flex-col gap-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-zinc-300">3. 接口调用日志</h3>
          <button
            @click="clearLogs"
            class="text-[10px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            清空日志
          </button>
        </div>

        <div
          class="flex-1 space-y-1.5 overflow-y-auto rounded border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-[10px] text-zinc-400"
        >
          <div v-if="actionLogs.length === 0" class="text-zinc-600 italic">
            暂无接口调用事件。请拖拽或操作面板...
          </div>
          <div v-for="(log, idx) in actionLogs" :key="idx" class="leading-normal break-all">
            <span class="text-indigo-400">[{{ log.time }}]</span>
            <span class="text-zinc-200"> {{ log.msg }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right panel: Desktop Simulator -->
    <div
      class="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-slate-900 p-6"
    >
      <!-- Simulated desktop container background -->
      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-950/20 via-zinc-900/60 to-purple-950/20"
      ></div>

      <!-- Desktop Viewport Header info -->
      <div class="z-10 mb-4 text-center">
        <h3 class="text-sm font-medium text-zinc-300">模拟桌面环境 (Simulated Desktop)</h3>
        <p class="mt-0.5 text-xs text-zinc-500">尺寸: 800 x 500 px | 横向中心参考线位于 X = 400</p>
      </div>

      <!-- Simulated Screen Area -->
      <div
        class="relative flex h-[500px] w-[800px] shrink-0 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-2xl select-none"
      >
        <!-- Mock Desktop Top Bar -->
        <div
          class="pointer-events-none z-10 flex h-6 w-full items-center justify-between border-b border-zinc-800/60 bg-zinc-900/40 px-4 text-[11px] text-zinc-500 backdrop-blur"
        >
          <div class="flex items-center gap-4">
            <span class="font-semibold text-zinc-300"> Willow</span>
            <span>文件</span>
            <span>编辑</span>
            <span>视图</span>
            <span>窗口</span>
          </div>
          <div class="flex items-center gap-3">
            <span>100%</span>
            <span>5月22日 周五 13:12</span>
          </div>
        </div>

        <!-- Vertical Center Line Guide -->
        <div
          class="pointer-events-none absolute top-6 bottom-0 left-1/2 z-0 w-px border-l border-dashed border-zinc-800/30"
        ></div>

        <!-- Simulated Electron Window representing the Floating Ball window bounds -->
        <div
          class="simulated-window absolute border border-dashed border-zinc-700/80 bg-zinc-950/30 transition-all"
          :class="[
            simWidth > 80 ? 'rounded-2xl' : 'rounded-full',
            simFocusable ? 'shadow-[0_0_12px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500' : '',
          ]"
          :style="{
            left: simX + 'px',
            top: simY + 'px',
            width: simWidth + 'px',
            height: simHeight + 'px',
            transitionDuration: '80ms',
            zIndex: 10,
          }"
        >
          <!-- Floating Ball component -->
          <FloatingBall />
        </div>

        <!-- Screen background decorations -->
        <div class="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <div class="h-96 w-96 rounded-full bg-purple-600/5 blur-[120px]"></div>
          <div class="-mt-20 h-80 w-80 rounded-full bg-indigo-600/5 blur-[100px]"></div>
        </div>

        <!-- Floating Ball Status Overlay on Mock Screen -->
        <div
          class="pointer-events-none absolute bottom-3 left-4 z-10 font-mono text-[10px] text-zinc-500"
        >
          window bounds: x={{ simX }}, y={{ simY }}, size={{ simWidth }}x{{ simHeight }},
          focusable={{ simFocusable }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Force the floating ball container to adapt to the simulated window boundaries */
.simulated-window :deep(.floating-ball-container) {
  width: 100% !important;
  height: 100% !important;
  padding: 15px !important;
}

/* Custom scrollbar styling for debug console */
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}
</style>
