# @willow/ai-core

AI 逻辑中枢包，基于 [@mariozechner/pi-ai](https://github.com/badlogic/pi-mono) 和 `@mariozechner/pi-agent-core` 构建，为 Electron 客户端提供统一的 AI 能力层。

## 安装

```bash
pnpm add @willow/ai-core
```

需要配置环境变量以使用对应厂商：

```bash
# 通义千问
export DASHSCOPE_API_KEY="sk-xxx"

# DeepSeek
export DEEPSEEK_API_KEY="sk-xxx"
```

## 核心概念

| 模块 | 职责 |
|------|------|
| **模型注册** | 注册 Qwen / DeepSeek 等 pi-ai 未内置的模型，也可访问 pi-ai 内置的所有厂商 |
| **ModelAdapter** | 封装 `pi-ai` 的 `stream()` / `complete()` 和 `pi-agent-core` 的 `Agent`，提供统一调用入口 |
| **StreamTransformer** | 将 pi-ai 流事件转换为可序列化的 `WillowStreamEvent`，适合通过 Electron IPC 传输 |
| **TokenGuard** | 发送前估算 Token 数，自动裁剪历史消息防止上下文溢出 |
| **SessionManager** | 会话全生命周期管理（CRUD、消息发送、事件订阅、持久化） |
| **ConversationTree** | 树状对话结构，支持多分支对话和分支切换 |
| **Serializer** | 会话序列化为 JSON，便于存入 SQLite 或文件 |
| **PromptBuilder** | 动态构建 System Prompt，支持模板变量和上下文注入 |

## 快速开始

### 1. 基础对话（流式）

```typescript
import { ModelAdapter } from "@willow/ai-core";

const adapter = new ModelAdapter();

await adapter.chat("deepseek", "deepseek-chat", {
  systemPrompt: "你是一个有帮助的助手。",
  messages: [
    { role: "user", content: "你好，介绍一下你自己", timestamp: Date.now() },
  ],
}, (event) => {
  switch (event.type) {
    case "stream:text-delta":
      process.stdout.write(event.delta);
      break;
    case "stream:done":
      console.log("\n完成:", event.message.usage);
      break;
    case "stream:error":
      console.error("错误:", event.error);
      break;
  }
}, {
  apiKey: "sk-xxx", // 可选，默认从环境变量读取
});
```

### 2. 非流式对话

```typescript
import { ModelAdapter } from "@willow/ai-core";

const adapter = new ModelAdapter();
const result = await adapter.chatComplete("qwen", "qwen-plus", {
  systemPrompt: "用一句话回答问题。",
  messages: [
    { role: "user", content: "天空为什么是蓝色的？", timestamp: Date.now() },
  ],
});

console.log(result.content[0]); // { type: "text", text: "..." }
console.log(result.usage);      // { input: 20, output: 35, ... }
```

### 3. 直接使用 pi-ai（不经过 ModelAdapter）

`@willow/ai-core` 的模型注册层可以独立使用，与 pi-ai 原生 API 配合：

```typescript
import { resolveModel, listModels, listProviders } from "@willow/ai-core";
import { stream } from "@mariozechner/pi-ai";

// 解析模型（自动初始化 Qwen / DeepSeek 注册）
const model = resolveModel("qwen", "qwen-turbo");

// 直接调用 pi-ai
const s = stream(model, {
  messages: [{ role: "user", content: "你好", timestamp: Date.now() }],
}, {
  apiKey: process.env.DASHSCOPE_API_KEY,
});

for await (const event of s) {
  if (event.type === "text_delta") {
    process.stdout.write(event.delta);
  }
}

// 列出所有可用模型
console.log(listProviders());          // ["qwen", "deepseek", "anthropic", ...]
console.log(listModels("deepseek"));   // [Model, Model]
```

## 会话管理

### SessionManager

`SessionManager` 提供完整的会话生命周期管理，内部整合了对话树、Token 管理和流式转换：

```typescript
import { SessionManager } from "@willow/ai-core";

const manager = new SessionManager();

// 创建会话
const session = manager.createSession({
  provider: "deepseek",
  modelId: "deepseek-chat",
  systemPrompt: "你是一个编程助手。",
  title: "代码问答",
});

// 订阅会话事件
manager.subscribe(session.id, (event) => {
  if (event.type === "session:stream") {
    const streamEvent = event.event;
    if (streamEvent.type === "stream:text-delta") {
      process.stdout.write(streamEvent.delta);
    }
  }
});

// 发送消息（自动管理对话树 + Token 裁剪）
await manager.sendMessage(session.id, "如何在 TypeScript 中使用泛型？", (event) => {
  // 逐事件回调
});

// 继续对话
await manager.sendMessage(session.id, "能给一个实际例子吗？", (event) => {});

// 列出 / 获取 / 删除
const sessions = manager.listSessions();
const found = manager.getSession(session.id);
manager.deleteSession(session.id);
```

### 分支对话

从对话中的任意节点创建新分支，实现「从这里重新开始」：

```typescript
// 获取当前活跃路径的消息
const messages = manager.getActiveMessages(session.id);

// 从某条消息的节点创建新分支
// 先获取会话的对话树，找到目标节点 ID
const sessionData = manager.getSession(session.id);
const tree = sessionData.tree;

// 从指定节点创建分支并发送新消息
await manager.branchAndSend(session.id, targetNodeId, "换一种方式解释", (event) => {
  if (event.type === "stream:text-delta") {
    process.stdout.write(event.delta);
  }
});

// 切换回之前的分支
manager.switchBranch(session.id, previousNodeId);
```

### 会话持久化

```typescript
// 导出单个会话为 JSON
const json = manager.exportSession(session.id);
// json 可存入 SQLite、文件系统等

// 导入会话
const restored = manager.importSession(json);

// 批量导出 / 导入
const allJson = manager.exportAll();
manager.importAll(allJson);
```

## 对话树（ConversationTree）

如果需要脱离 `SessionManager` 直接操作对话树：

```typescript
import { ConversationTree } from "@willow/ai-core";

const tree = new ConversationTree();

// 追加消息
const userNode = tree.append({
  role: "user",
  content: "你好",
  timestamp: Date.now(),
});

const assistantNode = tree.append({
  role: "assistant",
  content: [{ type: "text", text: "你好！有什么可以帮你的？" }],
  api: "openai-completions",
  provider: "qwen",
  model: "qwen-plus",
  usage: { input: 5, output: 10, cacheRead: 0, cacheWrite: 0, totalTokens: 15, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
  stopReason: "stop",
  timestamp: Date.now(),
});

// 从助手回复处创建新分支
const branchNode = tree.branch(assistantNode.id, {
  role: "user",
  content: "介绍一下 Rust 语言",
  timestamp: Date.now(),
});

// 获取当前活跃路径（发送给 LLM 的上下文）
const path = tree.getActivePath();
// → [userMsg, assistantMsg, branchMsg]

// 查看兄弟分支
const siblings = tree.getSiblings(branchNode.id);

// 切换分支
tree.switchBranch(assistantNode.id);

// 序列化 / 反序列化
const data = tree.serialize();
const restored = ConversationTree.deserialize(data);
```

## Token 管理（TokenGuard）

```typescript
import { TokenGuard, resolveModel } from "@willow/ai-core";

const guard = new TokenGuard();
const model = resolveModel("deepseek", "deepseek-chat");

const context = {
  systemPrompt: "你是助手。",
  messages: [
    { role: "user" as const, content: "很长的消息...", timestamp: Date.now() },
  ],
};

// 估算 Token 数
const tokens = guard.estimateContextTokens(context);

// 检查是否溢出
const result = guard.checkOverflow(model, context);
if (result.overflow) {
  console.log(`超出 ${result.contextWindow} 限制，当前估算 ${result.estimatedTokens}`);
}

// 自动裁剪（保留最近的消息）
const trimmed = guard.truncateContext(model, context);
// trimmed.messages 只包含能放入上下文窗口的最近消息
```

## 动态 System Prompt（PromptBuilder）

```typescript
import { PromptBuilder } from "@willow/ai-core";

const builder = new PromptBuilder()
  .setTemplate("你是 {{appName}} 的智能助手，专注于 {{domain}} 领域。")
  .setVariable("appName", "Willow")
  .setVariable("domain", "软件开发")
  .withProjectContext("/Users/dev/my-project", {
    NODE_ENV: "development",
    LANG: "zh_CN",
  })
  .addContext("项目技术栈", "Vue 3, TypeScript, Electron, Pinia");

const prompt = builder.build();
// → "你是 Willow 的智能助手，专注于 软件开发 领域。
//
//    <当前项目路径>
//    /Users/dev/my-project
//    </当前项目路径>
//
//    <环境变量>
//    NODE_ENV=development
//    LANG=zh_CN
//    </环境变量>
//
//    <项目技术栈>
//    Vue 3, TypeScript, Electron, Pinia
//    </项目技术栈>"

// SessionManager 中使用
const manager = new SessionManager();
const session = manager.createSession({
  provider: "qwen",
  modelId: "qwen-plus",
  systemPrompt: "基础 prompt",
});

// 动态修改 prompt
const pb = manager.getPromptBuilder(session.id);
pb.setTemplate("你是 {{role}}。").setVariable("role", "代码审查专家");
pb.addContext("当前文件", "src/main.ts 的内容...");
```

## 流式事件（WillowStreamEvent）

所有流式事件均可通过 Electron IPC 安全传输（纯 JSON，无循环引用）：

| 事件类型 | 说明 | 关键字段 |
|----------|------|----------|
| `stream:start` | 流开始 | `sessionId`, `messageId` |
| `stream:text-delta` | 文本增量 | `delta`, `messageId` |
| `stream:text-end` | 文本块结束 | `content`, `messageId` |
| `stream:thinking-delta` | 思考过程增量 | `delta`, `messageId` |
| `stream:thinking-end` | 思考结束 | `content`, `messageId` |
| `stream:tool-call` | 工具调用完成 | `toolCall`, `messageId` |
| `stream:usage` | Token 用量 | `usage`, `messageId` |
| `stream:done` | 流完成 | `message`, `sessionId` |
| `stream:error` | 错误 | `error`, `sessionId` |

### 在 Electron 主进程中使用

```typescript
// main process
import { SessionManager } from "@willow/ai-core";
import { ipcMain, BrowserWindow } from "electron";

const manager = new SessionManager();

ipcMain.handle("chat:send", async (event, sessionId, content) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  await manager.sendMessage(sessionId, content, (streamEvent) => {
    // 通过 IPC 推送到渲染进程
    win.webContents.send("chat:stream", streamEvent);
  });
});
```

## 自定义模型注册

注册 pi-ai 未内置的 OpenAI 兼容厂商：

```typescript
import { registerProvider, registerModel } from "@willow/ai-core";

// 方式一：注册整个 provider
registerProvider({
  name: "my-provider",
  baseUrl: "https://api.example.com/v1",
  envApiKey: "MY_API_KEY",
  models: [
    {
      id: "my-model-v1",
      name: "My Model V1",
      provider: "my-provider",
      api: "openai-completions",
      baseUrl: "https://api.example.com/v1",
      reasoning: false,
      input: ["text"],
      contextWindow: 128000,
      maxTokens: 4096,
      cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
      envApiKey: "MY_API_KEY",
    },
  ],
});

// 方式二：注册单个模型
registerModel({
  id: "custom-model",
  name: "Custom Model",
  provider: "custom",
  api: "openai-completions",
  baseUrl: "https://api.custom.com/v1",
  reasoning: false,
  input: ["text"],
  contextWindow: 32000,
  maxTokens: 4096,
  cost: { input: 0.5, output: 1, cacheRead: 0, cacheWrite: 0 },
  envApiKey: "CUSTOM_API_KEY",
});
```

## 内置模型

### Qwen（通义千问）

| 模型 ID | 上下文窗口 | 推理能力 | 输入类型 |
|---------|-----------|---------|---------|
| `qwen-turbo` | 128K | 否 | text |
| `qwen-plus` | 128K | 否 | text |
| `qwen-max` | 32K | 否 | text, image |
| `qwen-long` | 1M | 否 | text |

### DeepSeek

| 模型 ID | 上下文窗口 | 推理能力 | 输入类型 |
|---------|-----------|---------|---------|
| `deepseek-chat` | 64K | 否 | text |
| `deepseek-reasoner` | 64K | 是 (R1) | text |

### pi-ai 内置厂商

通过 `resolveModel()` 还可以访问 pi-ai 内置的所有厂商（OpenAI、Anthropic、Google、Groq、xAI 等），无需额外注册。

## Agent 模式（工具调用）

通过 `ModelAdapter.createAgent()` 创建支持工具调用循环的 Agent：

```typescript
import { ModelAdapter } from "@willow/ai-core";
import { Type } from "@sinclair/typebox";

const adapter = new ModelAdapter();

const agent = adapter.createAgent({
  provider: "deepseek",
  modelId: "deepseek-chat",
  systemPrompt: "你是一个能查询天气的助手。",
  tools: [
    {
      name: "get_weather",
      label: "查询天气",
      description: "获取指定城市的当前天气",
      parameters: Type.Object({
        city: Type.String({ description: "城市名称" }),
      }),
      execute: async (_id, params) => ({
        content: [{ type: "text", text: `${params.city}：晴，25°C` }],
        details: { city: params.city },
      }),
    },
  ],
});

// 订阅事件
agent.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
  if (event.type === "tool_execution_start") {
    console.log(`\n调用工具: ${event.toolName}`);
  }
});

// 发送消息（自动执行工具调用循环）
await agent.prompt("北京今天天气怎么样？");
```

## 构建

```bash
cd packages/ai-core
pnpm build    # tsup → CJS + ESM + .d.ts
pnpm dev      # tsup --watch
```
