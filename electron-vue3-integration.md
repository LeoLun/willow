# Electron + Vue 3 集成 pi-web-ui 方案一

主进程运行 Agent，渲染进程使用 `MessageList` + `StreamingMessageContainer` Web Component 渲染消息，Vue 3 封装交互逻辑。

## 项目结构

```
my-electron-app/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main/                          # Electron 主进程
│   │   ├── main.ts
│   │   ├── preload.ts
│   │   └── agent-bridge.ts
│   └── renderer/                      # Vue 3 渲染进程
│       ├── main.ts
│       ├── App.vue
│       ├── env.d.ts
│       ├── composables/
│       │   └── useAgentBridge.ts
│       └── components/
│           ├── MessageListView.vue
│           └── StreamingMessage.vue
```

## 依赖

```json
{
  "dependencies": {
    "@mariozechner/pi-agent-core": "^0.62.0",
    "@mariozechner/pi-ai": "^0.62.0",
    "@mariozechner/pi-web-ui": "^0.62.0",
    "@mariozechner/mini-lit": "^0.2.0",
    "lit": "^3.3.1"
  },
  "devDependencies": {
    "vue": "^3.5.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^6.0.0",
    "electron": "^33.0.0",
    "typescript": "^5.7.0"
  }
}
```

---

## 主进程

### src/main/preload.ts

```typescript
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("agentBridge", {
  onAgentEvent(callback: (event: any) => void) {
    const handler = (_: Electron.IpcRendererEvent, event: any) => callback(event);
    ipcRenderer.on("agent:event", handler);
    return () => {
      ipcRenderer.removeListener("agent:event", handler);
    };
  },

  getState(): Promise<any> {
    return ipcRenderer.invoke("agent:get-state");
  },

  prompt(text: string): Promise<void> {
    return ipcRenderer.invoke("agent:prompt", text);
  },

  abort(): Promise<void> {
    return ipcRenderer.invoke("agent:abort");
  },
});
```

### src/main/agent-bridge.ts

```typescript
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { ipcMain, type BrowserWindow } from "electron";

let agent: Agent;

export function setupAgentBridge(win: BrowserWindow) {
  agent = new Agent({
    initialState: {
      systemPrompt: "You are a helpful assistant.",
      model: getModel("anthropic", "claude-sonnet-4-5-20250929"),
      thinkingLevel: "off",
      messages: [],
      tools: [],
    },
  });

  // 转发 Agent 事件到渲染进程
  agent.subscribe((event) => {
    if (win.isDestroyed()) return;

    // 序列化事件（IPC 只能传递可序列化数据）
    // AgentEvent 中的 message 等字段需要 structuredClone 处理
    try {
      const serializable: Record<string, any> = { type: event.type };

      switch (event.type) {
        case "agent_start":
          break;

        case "agent_end":
          serializable.messages = event.messages;
          break;

        case "turn_start":
          break;

        case "turn_end":
          serializable.message = event.message;
          serializable.toolResults = event.toolResults;
          break;

        case "message_start":
        case "message_end":
          serializable.message = event.message;
          break;

        case "message_update":
          serializable.message = event.message;
          // assistantMessageEvent 含流式内容，序列化传递
          serializable.assistantMessageEvent = event.assistantMessageEvent;
          break;

        case "tool_execution_start":
        case "tool_execution_update":
        case "tool_execution_end":
          serializable.toolCallId = event.toolCallId;
          serializable.toolName = event.toolName;
          if ("args" in event) serializable.args = event.args;
          if ("partialResult" in event) serializable.partialResult = event.partialResult;
          if ("result" in event) serializable.result = event.result;
          if ("isError" in event) serializable.isError = event.isError;
          break;
      }

      win.webContents.send("agent:event", serializable);
    } catch (err) {
      console.error("Failed to serialize agent event:", err);
    }
  });

  // 获取完整状态快照
  ipcMain.handle("agent:get-state", () => {
    const state = agent.state;
    return {
      messages: state.messages,
      // tools 包含不可序列化的函数，只传递元信息
      tools: state.tools.map((t) => ({
        name: t.name,
        label: t.label,
        description: t.description,
      })),
      isStreaming: state.isStreaming,
      // Set 不可序列化，转为数组
      pendingToolCalls: [...state.pendingToolCalls],
      streamMessage: state.streamMessage,
    };
  });

  // 发送消息
  ipcMain.handle("agent:prompt", async (_event, text: string) => {
    await agent.prompt(text);
  });

  // 中止
  ipcMain.handle("agent:abort", () => {
    agent.abort();
  });
}
```

### src/main/main.ts

```typescript
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { setupAgentBridge } from "./agent-bridge.js";

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  setupAgentBridge(win);

  // 开发模式加载 Vite dev server，生产模式加载打包后的文件
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

---

## 渲染进程

### src/renderer/env.d.ts

```typescript
/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, any>;
  export default component;
}

interface AgentBridge {
  /** 监听主进程 Agent 事件，返回取消监听函数 */
  onAgentEvent: (callback: (event: any) => void) => () => void;
  /** 获取当前 Agent 状态快照 */
  getState: () => Promise<{
    messages: any[];
    tools: { name: string; label: string; description: string }[];
    isStreaming: boolean;
    pendingToolCalls: string[];
    streamMessage: any | null;
  }>;
  /** 发送用户消息 */
  prompt: (text: string) => Promise<void>;
  /** 中止当前流式响应 */
  abort: () => Promise<void>;
}

interface Window {
  agentBridge: AgentBridge;
}
```

### src/renderer/main.ts

```typescript
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

### src/renderer/composables/useAgentBridge.ts

```typescript
import { reactive, onMounted, onUnmounted } from "vue";

interface AgentBridgeState {
  messages: any[];
  tools: any[];
  isStreaming: boolean;
  pendingToolCalls: Set<string>;
  streamMessage: any | null;
}

/**
 * 桥接主进程 Agent 状态到 Vue 响应式系统。
 *
 * 数据流:
 *   主进程 Agent.subscribe()
 *     -> IPC "agent:event"
 *     -> onAgentEvent callback
 *     -> 更新 reactive state
 *     -> Vue 组件自动重渲染
 */
export function useAgentBridge() {
  const state = reactive<AgentBridgeState>({
    messages: [],
    tools: [],
    isStreaming: false,
    pendingToolCalls: new Set(),
    streamMessage: null,
  });

  let removeListener: (() => void) | undefined;

  /** 从主进程拉取完整状态快照 */
  async function syncState() {
    const s = await window.agentBridge.getState();
    state.messages = s.messages;
    state.tools = s.tools;
    state.isStreaming = s.isStreaming;
    state.pendingToolCalls = new Set(s.pendingToolCalls);
    state.streamMessage = s.streamMessage;
  }

  onMounted(() => {
    // 初始加载
    syncState();

    // 监听 Agent 事件增量更新
    removeListener = window.agentBridge.onAgentEvent((event) => {
      switch (event.type) {
        case "agent_start":
          state.isStreaming = true;
          state.streamMessage = null;
          break;

        case "message_update":
          // 流式消息更新，直接替换 streamMessage
          state.streamMessage = event.message;
          break;

        case "message_end":
          // 单条消息完成，清除流式消息并同步完整列表
          state.streamMessage = null;
          syncState();
          break;

        case "agent_end":
          // Agent 循环结束
          state.isStreaming = false;
          state.streamMessage = null;
          syncState();
          break;

        case "turn_start":
        case "turn_end":
        case "message_start":
        case "tool_execution_start":
        case "tool_execution_update":
        case "tool_execution_end":
          // 这些事件可能导致 pendingToolCalls 等变化，重新同步
          syncState();
          break;
      }
    });
  });

  onUnmounted(() => {
    removeListener?.();
  });

  async function prompt(text: string) {
    if (!text.trim() || state.isStreaming) return;
    await window.agentBridge.prompt(text);
  }

  function abort() {
    window.agentBridge.abort();
  }

  return { state, prompt, abort };
}
```

### src/renderer/components/MessageListView.vue

```vue
<template>
  <div ref="container" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
// 导入会触发 customElements.define 注册
// 注册的自定义元素: message-list, user-message, assistant-message,
// tool-message, tool-message-debug, aborted-message,
// streaming-message-container, thinking-block, console-block,
// expandable-section 等
import "@mariozechner/pi-web-ui";
import "@mariozechner/pi-web-ui/app.css";
import type { MessageList } from "@mariozechner/pi-web-ui";

const props = defineProps<{
  messages: any[];
  tools: any[];
  isStreaming: boolean;
  pendingToolCalls: Set<string>;
}>();

const container = ref<HTMLElement>();
let el: MessageList;

onMounted(() => {
  // 通过 JS 创建 Web Component 并直接赋值属性（非 attribute）
  // 确保复杂类型（Array、Set）正确传递
  el = document.createElement("message-list") as MessageList;
  syncAll();
  container.value!.appendChild(el);
});

function syncAll() {
  if (!el) return;
  el.messages = props.messages;
  el.tools = props.tools;
  el.isStreaming = props.isStreaming;
  el.pendingToolCalls = props.pendingToolCalls;
}

watch(() => props.messages, (v) => { if (el) el.messages = v; }, { deep: true });
watch(() => props.tools, (v) => { if (el) el.tools = v; });
watch(() => props.isStreaming, (v) => { if (el) el.isStreaming = v; });
watch(() => props.pendingToolCalls, (v) => { if (el) el.pendingToolCalls = v; });

onUnmounted(() => {
  el?.remove();
});
</script>
```

### src/renderer/components/StreamingMessage.vue

```vue
<template>
  <div ref="container" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import type { StreamingMessageContainer } from "@mariozechner/pi-web-ui";

const props = defineProps<{
  message: any | null;
  isStreaming: boolean;
  tools: any[];
  pendingToolCalls: Set<string>;
}>();

const container = ref<HTMLElement>();
let el: StreamingMessageContainer;

onMounted(() => {
  el = document.createElement(
    "streaming-message-container"
  ) as StreamingMessageContainer;
  el.isStreaming = props.isStreaming;
  el.tools = props.tools;
  el.pendingToolCalls = props.pendingToolCalls;
  if (props.message) {
    el.setMessage(props.message, !props.isStreaming);
  }
  container.value!.appendChild(el);
});

watch(
  () => props.message,
  (v) => {
    if (!el) return;
    el.setMessage(v, !props.isStreaming);
  }
);

watch(() => props.isStreaming, (v) => { if (el) el.isStreaming = v; });
watch(() => props.tools, (v) => { if (el) el.tools = v; });
watch(() => props.pendingToolCalls, (v) => { if (el) el.pendingToolCalls = v; });

onUnmounted(() => {
  el?.remove();
});
</script>
```

### src/renderer/App.vue

```vue
<template>
  <div class="h-screen flex flex-col bg-background text-foreground">
    <!-- 消息区域 -->
    <div
      ref="scrollArea"
      class="flex-1 overflow-y-auto"
    >
      <div class="max-w-3xl mx-auto p-4">
        <!-- 已完成的消息 -->
        <MessageListView
          :messages="state.messages"
          :tools="state.tools"
          :is-streaming="state.isStreaming"
          :pending-tool-calls="state.pendingToolCalls"
        />

        <!-- 正在流式生成的消息 -->
        <StreamingMessage
          v-if="state.isStreaming"
          :message="state.streamMessage"
          :is-streaming="state.isStreaming"
          :tools="state.tools"
          :pending-tool-calls="state.pendingToolCalls"
        />
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="shrink-0 border-t border-border">
      <div class="max-w-3xl mx-auto px-4 py-3">
        <form class="flex gap-2" @submit.prevent="onSend">
          <input
            ref="inputEl"
            v-model="inputText"
            type="text"
            class="flex-1 px-3 py-2 rounded-lg border border-border bg-background
                   text-foreground placeholder:text-muted-foreground
                   focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="输入消息..."
            :disabled="state.isStreaming"
            @keydown.enter.exact.prevent="onSend"
          />
          <button
            v-if="!state.isStreaming"
            type="submit"
            :disabled="!inputText.trim()"
            class="px-4 py-2 rounded-lg bg-primary text-primary-foreground
                   disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            发送
          </button>
          <button
            v-else
            type="button"
            class="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground
                   hover:opacity-90 transition-opacity"
            @click="abort"
          >
            停止
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import MessageListView from "./components/MessageListView.vue";
import StreamingMessage from "./components/StreamingMessage.vue";
import { useAgentBridge } from "./composables/useAgentBridge";

const { state, prompt, abort } = useAgentBridge();

const inputText = ref("");
const inputEl = ref<HTMLInputElement>();
const scrollArea = ref<HTMLElement>();

async function onSend() {
  const text = inputText.value.trim();
  if (!text || state.isStreaming) return;
  inputText.value = "";
  await prompt(text);
}

// 自动滚动到底部
watch(
  () => [state.messages.length, state.streamMessage],
  async () => {
    await nextTick();
    if (scrollArea.value) {
      scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
    }
  }
);
</script>
```

### index.html

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
</head>
<body class="bg-background text-foreground">
  <div id="app"></div>
  <script type="module" src="/src/renderer/main.ts"></script>
</body>
</html>
```

---

## 构建配置

### vite.config.ts

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // pi-web-ui 注册的所有自定义元素，告诉 Vue 不要解析为 Vue 组件
          isCustomElement: (tag) =>
            [
              // 核心消息组件
              "message-list",
              "user-message",
              "assistant-message",
              "streaming-message-container",
              "tool-message",
              "tool-message-debug",
              "aborted-message",
              // 消息内部子组件
              "thinking-block",
              "console-block",
              "expandable-section",
              "attachment-tile",
              // Artifacts 相关
              "artifacts-panel",
              "html-artifact",
              "svg-artifact",
              "markdown-artifact",
              "text-artifact",
              "image-artifact",
              "generic-artifact",
              "docx-artifact",
              "excel-artifact",
              "pdf-artifact",
              "artifact-console",
              "sandbox-iframe",
              // 其他
              "agent-interface",
              "pi-chat-panel",
              "message-editor",
              "provider-key-input",
              "custom-provider-card",
              "theme-toggle",
              // 对话框
              "agent-model-selector",
              "session-list-dialog",
              "settings-dialog",
              "api-keys-tab",
              "proxy-tab",
              "api-key-prompt-dialog",
              "attachment-overlay",
              "persistent-storage-dialog",
              "providers-models-tab",
              "custom-provider-dialog",
            ].includes(tag),
        },
      },
    }),
  ],
});
```

---

## 数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│ 主进程                                                              │
│                                                                     │
│  Agent ──subscribe──► agent_start       ──► IPC "agent:event" ──┐   │
│    │                  message_update     ──► IPC "agent:event" ──┤   │
│    │                  message_end        ──► IPC "agent:event" ──┤   │
│    │                  agent_end          ──► IPC "agent:event" ──┤   │
│    │                  tool_execution_*   ──► IPC "agent:event" ──┤   │
│    │                                                             │   │
│    ◄─── ipcMain.handle("agent:prompt") ◄── IPC invoke ◄─────────┤   │
│    ◄─── ipcMain.handle("agent:abort")  ◄── IPC invoke ◄─────────┤   │
│    ──── ipcMain.handle("agent:get-state") ► IPC response ───────┤   │
└─────────────────────────────────────────────────────────────────┘│   │
                                                                   │   │
┌──────────────────────────────────────────────────────────────────┘   │
│ preload.ts  (contextBridge)                                         │
│  window.agentBridge.onAgentEvent() ◄────────────────────────────────┘
│  window.agentBridge.getState()
│  window.agentBridge.prompt()
│  window.agentBridge.abort()
└──────────────────┬──────────────────────────────────────────────────
                   │
┌──────────────────▼──────────────────────────────────────────────────┐
│ 渲染进程 (Vue 3)                                                     │
│                                                                      │
│  useAgentBridge()                                                    │
│    ├─ reactive state ──► messages        ──► MessageListView.vue     │
│    │                     streamMessage   ──► StreamingMessage.vue     │
│    │                     isStreaming                                  │
│    │                     pendingToolCalls                             │
│    │                                                                 │
│    ├─ prompt(text)   ──► IPC invoke ──► 主进程 Agent.prompt()        │
│    └─ abort()        ──► IPC invoke ──► 主进程 Agent.abort()         │
│                                                                      │
│  MessageListView.vue                                                 │
│    └─ <message-list> Web Component                                   │
│        ├─ .messages = state.messages                                 │
│        ├─ .tools = state.tools                                       │
│        ├─ .isStreaming = state.isStreaming                            │
│        └─ .pendingToolCalls = state.pendingToolCalls                 │
│                                                                      │
│  StreamingMessage.vue                                                │
│    └─ <streaming-message-container> Web Component                    │
│        ├─ .setMessage(streamMessage)                                 │
│        ├─ .isStreaming = state.isStreaming                            │
│        └─ .tools = state.tools                                       │
│                                                                      │
│  App.vue                                                             │
│    ├─ 滚动容器 + 自动滚动                                             │
│    └─ 输入框 + 发送/停止按钮                                           │
└──────────────────────────────────────────────────────────────────────┘
```

## 注意事项

1. **IPC 序列化限制**: `Set`、`Map`、函数都不能通过 IPC 传递。`pendingToolCalls` 在主进程是 `Set<string>`，通过 IPC 传为数组，在渲染进程重建为 `Set`。`tools` 只传元信息（name/label/description），不传 `execute` 函数。

2. **CSS 主题**: `@mariozechner/pi-web-ui/app.css` 包含 Tailwind CSS 和主题变量（`--background`、`--foreground` 等）。确保 `<body>` 或根元素上有 `bg-background text-foreground` class。

3. **Web Component 属性传递**: 必须通过 JS property 赋值（`el.messages = [...]`），不能通过 HTML attribute（`<message-list messages="...">` 会变成字符串）。这就是为什么 Vue 组件中用 `document.createElement` 而不是模板语法。

4. **`message_update` 频率**: 流式响应时 `message_update` 会高频触发。`StreamingMessageContainer` 内部已做 `requestAnimationFrame` 批量更新，不需要在 Vue 层额外节流。

5. **Electron 安全策略**: `contextIsolation: true` + `nodeIntegration: false` 是推荐配置。所有主进程通信都通过 `contextBridge` 暴露的 `agentBridge` 对象。
