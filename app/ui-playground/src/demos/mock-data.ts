import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type {
  AssistantMessage,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from "@mariozechner/pi-ai";

const timestamp = Date.now();

export const demoTools: AgentTool[] = [
  { name: "bash", description: "Run shell commands" } as AgentTool,
  { name: "web_search", description: "Search the web" } as AgentTool,
];

export const conversationMessages: AgentMessage[] = [
  {
    role: "user",
    content: "帮我概括一下最近的构建异常，并给出一个修复方向。",
    timestamp,
  } as UserMessage,
  {
    role: "assistant",
    content: [
      {
        type: "thinking",
        thinking: "我先查看最近的错误日志，再确认是否集中在同一条依赖链路上。",
      },
      {
        type: "text",
        text: "我先检查了错误模式，发现异常主要集中在 `vite` 构建链路与 CSS token 注入上。",
      },
      {
        type: "toolCall",
        id: "call-bash-1",
        name: "bash",
        arguments: {
          command: "pnpm lint",
          cwd: "/Users/liujinglun/code/willow",
        },
      },
      {
        type: "text",
        text: "从输出看，主要问题是新页面未接入现有样式基线。建议先对齐 `DESIGN.md` 和共享 token，再处理具体组件差异。",
      },
    ],
    stopReason: "endTurn",
    usage: {
      inputTokens: 864,
      outputTokens: 214,
      reasoningTokens: 96,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      totalTokens: 1174,
      cost: 0.0162,
    },
    timestamp: timestamp + 1,
  } as AssistantMessage,
  {
    role: "toolResult",
    toolCallId: "call-bash-1",
    toolName: "bash",
    isError: false,
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            summary: "lint passed",
            changedFiles: ["app/ui-playground/src/App.vue"],
            warnings: [],
          },
          null,
          2,
        ),
      },
    ],
    details: { exitCode: 0 },
    timestamp: timestamp + 2,
  } as ToolResultMessage,
];

export const streamingMessage = {
  role: "assistant",
  content: [
    {
      type: "thinking",
      thinking: "我正在整理消息区和工具渲染区的布局层级。",
    },
    {
      type: "text",
      text: "正在生成调试页骨架，接下来会补上工具调用和边界状态样例。",
    },
    {
      type: "toolCall",
      id: "call-web-1",
      name: "web_search",
      arguments: JSON.stringify({
        query: "vite open localhost",
        limit: 5,
      }),
    },
  ],
  stopReason: "maxTokens",
  timestamp: timestamp + 3,
} as AssistantMessage;

export const pendingToolCalls = new Set<string>(["call-web-1"]);

export const markdownSample = `# UI Playground 检查清单

这是一个用于调试 \`@willow/ui\` 的独立页面，它应该保持工具型、冷静、易扫描。

## 关注点

- Markdown 排版是否稳定
- 代码块与语法高亮是否正常
- 表格、引用和数学公式是否可读

> 这块内容用于模拟较长的回复说明，方便检查段落间距、边框和行高。

| Slice | Goal | Status |
| --- | --- | --- |
| 1 | localhost 入口 | Done |
| 2 | 共享样式基线 | In Progress |

\`\`\`ts
const status = {
  script: "pnpm dev:ui",
  host: "127.0.0.1:4173",
  ready: true,
};
\`\`\`

行内公式 $E = mc^2$ 与块公式：

$$
f(x) = \\int_{-\\infty}^{\\infty} e^{-t^2} dt
$$`;

export const webSearchToolCall = {
  id: "call-websearch-1",
  name: "web_search",
  arguments: JSON.stringify({
    query: "best practices for vite localhost dev server",
    limit: 3,
  }),
} as ToolCall;

export const webSearchResult = {
  role: "toolResult",
  toolCallId: "call-websearch-1",
  toolName: "web_search",
  isError: false,
  content: [
    {
      type: "text",
      text: JSON.stringify(
        [
          {
            title: "Vite Server Options",
            url: "https://vite.dev/config/server-options",
            note: "Configure host, port, and open behavior.",
          },
        ],
        null,
        2,
      ),
    },
  ],
  details: { source: "demo" },
  timestamp: timestamp + 4,
} as ToolResultMessage;

export const failedBashToolCall = {
  id: "call-bash-2",
  name: "bash",
  arguments: {
    command: "pnpm --filter ./app/ui-playground run dev",
  },
} as ToolCall;

export const failedBashResult = {
  role: "toolResult",
  toolCallId: "call-bash-2",
  toolName: "bash",
  isError: true,
  content: [
    {
      type: "text",
      text: "Port 4173 is already in use. Stop the existing dev server or choose another fixed port.",
    },
  ],
  details: { exitCode: 1 },
  timestamp: timestamp + 5,
} as ToolResultMessage;

export const errorAssistantMessage = {
  role: "assistant",
  content: [
    {
      type: "text",
      text: "在启动 dev server 时遇到了一个冲突，我保留了错误信息方便检查样式。",
    },
  ],
  stopReason: "error",
  errorMessage: "listen EADDRINUSE: address already in use 127.0.0.1:4173",
  timestamp: timestamp + 6,
} as AssistantMessage;

export const longUserMessage = {
  role: "user",
  content:
    "请把消息面板、工具结果区和长段落排版一起检查一遍。" +
    " 这段文字故意写得比较长，用来观察多行换行、左右留白和在窄容器中的阅读节奏是否稳定。",
  timestamp: timestamp + 7,
} as UserMessage;
