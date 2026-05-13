import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type {
  AssistantMessage,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from "@mariozechner/pi-ai";
import type {
  SenderFileOption,
  SenderModelOption,
  SenderPluginOption,
  SenderSkillOption,
  SenderUsageMessage,
} from "@willow/sender";

const timestamp = Date.now();

export const demoTools: AgentTool[] = [
  { name: "bash", description: "Run shell commands" } as AgentTool,
  { name: "web_search", description: "Search the web" } as AgentTool,
  { name: "webfetch", description: "Fetch a web page" } as AgentTool,
  { name: "todoread", description: "Read todo list" } as AgentTool,
  { name: "todowrite", description: "Write todo list" } as AgentTool,
  { name: "automation_create", description: "Create automation" } as AgentTool,
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

export const senderModels: SenderModelOption[] = [
  {
    modelId: "deepseek-reasoner",
    name: "DeepSeek Reasoner",
    contextWindow: 64000,
  },
  {
    modelId: "gpt-5.4",
    name: "GPT-5.4",
    contextWindow: 128000,
  },
];

export const senderPlugins: SenderPluginOption[] = [
  {
    id: "browser-use",
    name: "Browser Use",
    description: "Control the in-app browser",
  },
];

export const senderSkills: SenderSkillOption[] = [
  {
    name: "workflow-spec",
    description: "把想法整理成 OpenSpec 变更文档与决策记录。",
    filePath: "/Users/liujinglun/code/willow/.agents/skills/workflow-spec/SKILL.md",
    scope: "global",
    scopeLabel: "全局",
  },
  {
    name: "workflow-plan",
    description: "把已批准的 OpenSpec 任务拆成可执行实施计划。",
    filePath: "/Users/liujinglun/code/willow/.agents/skills/workflow-plan/SKILL.md",
    scope: "global",
    scopeLabel: "全局",
  },
  {
    name: "workflow-implement",
    description: "按计划推进实现、验证并收口任务状态。",
    filePath: "/Users/liujinglun/code/willow/.agents/skills/workflow-implement/SKILL.md",
    scope: "workspace",
    scopeLabel: "工作空间",
  },
  {
    name: "vue-best-practices",
    description: "为 Vue 3 SFC、Composition API 和类型边界提供最佳实践。",
    filePath: "/Users/liujinglun/code/willow/.agents/skills/vue-best-practices/SKILL.md",
    scope: "workspace",
    scopeLabel: "工作空间",
  },
];

export const senderFiles: SenderFileOption[] = [
  {
    name: "App.vue",
    path: "/Users/liujinglun/code/willow/app/ui-playground/src/App.vue",
    relativePath: "app/ui-playground/src/App.vue",
    extension: "vue",
  },
  {
    name: "Sender.vue",
    path: "/Users/liujinglun/code/willow/packages/sender/src/components/Sender.vue",
    relativePath: "packages/sender/src/components/Sender.vue",
    extension: "vue",
  },
  {
    name: "types.ts",
    path: "/Users/liujinglun/code/willow/packages/sender/src/types.ts",
    relativePath: "packages/sender/src/types.ts",
    extension: "ts",
  },
  {
    name: "DESIGN.md",
    path: "/Users/liujinglun/code/willow/DESIGN.md",
    relativePath: "DESIGN.md",
    extension: "md",
  },
];

export const senderMessages: SenderUsageMessage[] = [
  {
    usage: {
      input: 12400,
      output: 1600,
    },
  },
  {
    usage: {
      input: 2800,
      output: 340,
    },
  },
];

export const senderStreamMessage: SenderUsageMessage = {
  usage: {
    input: 800,
    output: 220,
  },
};

export const markdownSample = `# UI Playground 检查清单

这是一个用于调试 \`@willow/ui\` 的独立页面，它应该保持工具型、冷静、易扫描。

## 关注点

- Markdown 排版是否稳定
- 代码块与语法高亮是否正常
- 表格、引用和数学公式是否可读
- 文件引用 [app.ts](/user/xxxx/app.ts)、技能引用 [$workflow-spec](skill/workflow-spec.md) 和普通链接 [OpenAI](https://openai.com) 是否各自按预期渲染

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
  details: {
    query: "best practices for vite localhost dev server",
    resultCount: 2,
    results: [
      {
        title: "Vite Server Options",
        url: "https://vite.dev/config/server-options",
      },
      {
        title: "Vite CLI",
        url: "https://vite.dev/guide/cli",
      },
    ],
  },
  timestamp: timestamp + 4,
} as ToolResultMessage;

export const webFetchToolCall = {
  id: "call-webfetch-1",
  name: "webfetch",
  arguments: JSON.stringify({
    url: "https://vite.dev/config/server-options",
    format: "markdown",
    timeoutMs: 8000,
  }),
} as ToolCall;

export const webFetchResult = {
  role: "toolResult",
  toolCallId: "call-webfetch-1",
  toolName: "webfetch",
  isError: false,
  content: [
    {
      type: "text",
      text: `# Server Options

Vite dev server options control host, port, open behavior, HTTPS, and proxy settings.

- \`server.host\`: listen address
- \`server.port\`: development port
- \`server.open\`: auto-open browser on startup`,
    },
  ],
  details: {
    url: "https://vite.dev/config/server-options",
    format: "markdown",
    timeoutMs: 8000,
    title: "Vite Server Options",
    outputLength: 212,
    fetchStatus: 200,
    returnedFormat: "markdown",
  },
  timestamp: timestamp + 4,
} as ToolResultMessage;

export const todoReadToolCall = {
  id: "call-todoread-1",
  name: "todoread",
  arguments: {
    todos: [
      { id: "todo-1", content: "梳理现有 renderer 类型", status: "completed" },
      { id: "todo-2", content: "为每一种工具调用补充 demo", status: "in_progress" },
      { id: "todo-3", content: "验证 localhost 页面可访问", status: "pending" },
    ],
  },
} as ToolCall;

export const todoReadResult = {
  role: "toolResult",
  toolCallId: "call-todoread-1",
  toolName: "todoread",
  isError: false,
  content: [{ type: "text", text: "当前共有 3 项待办，1 项正在进行中。" }],
  details: {
    todos: [
      { id: "todo-1", content: "梳理现有 renderer 类型", status: "completed" },
      { id: "todo-2", content: "为每一种工具调用补充 demo", status: "in_progress" },
      { id: "todo-3", content: "验证 localhost 页面可访问", status: "pending" },
    ],
  },
  timestamp: timestamp + 5,
} as ToolResultMessage;

export const todoWriteToolCall = {
  id: "call-todowrite-1",
  name: "todowrite",
  arguments: {
    todos: [
      { id: "todo-a", content: "补全工具 demo registry", status: "completed" },
      { id: "todo-b", content: "校对工具状态文案", status: "completed" },
      { id: "todo-c", content: "保留后续扩展示例入口", status: "pending" },
    ],
  },
} as ToolCall;

export const todoWriteResult = {
  role: "toolResult",
  toolCallId: "call-todowrite-1",
  toolName: "todowrite",
  isError: false,
  content: [{ type: "text", text: "待办列表已更新。" }],
  details: {
    todos: [
      { id: "todo-a", content: "补全工具 demo registry", status: "completed" },
      { id: "todo-b", content: "校对工具状态文案", status: "completed" },
      { id: "todo-c", content: "保留后续扩展示例入口", status: "pending" },
    ],
  },
  timestamp: timestamp + 6,
} as ToolResultMessage;

export const automationCreateToolCall = {
  id: "call-automation-create-1",
  name: "automation_create",
  arguments: {
    prompt: "每天下午 6 点提醒我检查 UI playground 的样式回归。",
    cronExpression: "0 18 * * *",
  },
} as ToolCall;

export const automationCreateResult = {
  role: "toolResult",
  toolCallId: "call-automation-create-1",
  toolName: "automation_create",
  isError: false,
  content: [{ type: "text", text: "自动化已创建。" }],
  details: {
    automation: {
      title: "UI Playground 每日回归",
      prompt: "每天下午 6 点提醒我检查 UI playground 的样式回归。",
      trigger: {
        cronExpression: "0 18 * * *",
        timezone: "Asia/Shanghai",
      },
    },
  },
  timestamp: timestamp + 7,
} as ToolResultMessage;

export const coreToolParams = {
  input: {
    ticker: "BTC",
    type: "crypto",
    market: "",
  },
};

export const coreToolResult = {
  role: "toolResult",
  toolCallId: "call-core-1",
  toolName: "finance",
  isError: false,
  content: [
    {
      type: "text",
      text: JSON.stringify(
        {
          price: 68321.24,
          currency: "USD",
          change24h: "+2.7%",
        },
        null,
        2,
      ),
    },
  ],
  details: { asset: "BTC" },
  timestamp: timestamp + 8,
} as ToolResultMessage;

export const defaultToolCall = {
  id: "call-default-1",
  name: "custom_renderer_missing",
  arguments: {
    payload: {
      path: "/tmp/output.json",
      attempts: 2,
    },
  },
} as ToolCall;

export const defaultToolResult = {
  role: "toolResult",
  toolCallId: "call-default-1",
  toolName: "custom_renderer_missing",
  isError: false,
  content: [
    {
      type: "text",
      text: JSON.stringify(
        {
          ok: true,
          message: "fallback renderer is working",
        },
        null,
        2,
      ),
    },
  ],
  details: { mode: "fallback" },
  timestamp: timestamp + 9,
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
  timestamp: timestamp + 10,
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
  timestamp: timestamp + 11,
} as AssistantMessage;

export const longUserMessage = {
  role: "user",
  content:
    "请把消息面板、工具结果区和长段落排版一起检查一遍。" +
    " 这段文字故意写得比较长，用来观察多行换行、左右留白和在窄容器中的阅读节奏是否稳定。",
  timestamp: timestamp + 12,
} as UserMessage;
