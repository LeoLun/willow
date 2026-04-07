# Change Tool Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 `openspec/changes/change-tool-design/` 完成统一 `createTool` 契约、低风险工具直通、`bash` 高危命令单次批准/拒绝，以及聊天界面的审批交互。

**Architecture:** 在 `packages/core` 增加共享工具定义层和权限决策包装；在主进程维护按 `toolCallId` 跟踪的待审批状态并通过会话流同步给 renderer；在 `packages/ui` 与 Electron renderer 中复用现有 tool message 渲染面承载审批按钮和最终结果。首版只支持单次批准/拒绝，不实现会话级记忆授权。

**Tech Stack:** TypeScript、Electron、Vue 3、`@mariozechner/pi-agent-core`、`@mariozechner/pi-ai`、pnpm workspace、oxlint、tsup

---

### Task 1: 统一工具定义契约

**Files:**
- Create: `packages/core/src/tools/create-tool.ts`
- Modify: `packages/core/src/tools/index.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/tools/ls.ts`
- Modify: `packages/core/src/tools/read.ts`
- Modify: `packages/core/src/tools/webfetch.ts`
- Modify: `packages/core/src/tools/websearch.ts`
- Modify: `packages/core/src/tools/find.ts`
- Modify: `packages/core/src/tools/grep.ts`
- Modify: `packages/core/src/tools/write.ts`
- Modify: `packages/core/src/tools/edit.ts`
- Modify: `packages/core/src/tools/bash.ts`
- Modify: `packages/core/src/tools/todoread.ts`
- Modify: `packages/core/src/tools/todowrite.ts`

- [ ] **Step 1: 新增共享工具类型文件**

```ts
import type { AgentTool } from "@mariozechner/pi-agent-core";

export type ToolPermissionDecision =
  | { mode: "allow" }
  | { mode: "ask"; reason: string; risk: "medium" | "high" };

export type ToolPermissionResolver<TParams> = (params: TParams) => ToolPermissionDecision;

export interface WillowToolMeta<TParams> {
  label: string;
  permission?: ToolPermissionResolver<TParams>;
}

export type WillowTool<TParams> = AgentTool<TParams> & {
  meta: WillowToolMeta<TParams>;
};
```

- [ ] **Step 2: 在 `create-tool.ts` 中实现共享 `createTool` 工厂**

```ts
export function createTool<TParams>(
  config: AgentTool<TParams> & { meta: WillowToolMeta<TParams> },
): WillowTool<TParams> {
  return {
    ...config,
    meta: config.meta,
  };
}
```

- [ ] **Step 3: 在 `packages/core/src/tools/index.ts` 中导出新类型与工厂**

```ts
export { createTool, type WillowTool, type ToolPermissionDecision } from "./create-tool";
```

- [ ] **Step 4: 将低风险工具迁移到共享工厂**

```ts
export function createFindTool(cwd: string) {
  return createTool({
    name: "find",
    label: "查找",
    description: "...",
    parameters: findSchema,
    meta: {
      label: "查找",
      permission: () => ({ mode: "allow" }),
    },
    async execute(_toolCallId, params) {
      // 保持现有实现
    },
  });
}
```

- [ ] **Step 5: 将 `bash` 也迁移到共享工厂，但先保留权限判断为空壳**

```ts
return createTool({
  name: "bash",
  label: "终端",
  description: "...",
  parameters: bashSchema,
  meta: {
    label: "终端",
    permission: (params) => classifyBashCommand(params.command ?? ""),
  },
  async execute(toolCallId, params, signal) {
    // 先保留现有执行逻辑
  },
});
```

- [ ] **Step 6: 运行基础静态检查**

Run: `pnpm --filter @willow/core run build`
Expected: `tsup` 成功输出 `dist/index.js` 和 `dist/index.d.ts`

- [ ] **Step 7: 提交**

```bash
git add packages/core/src/tools packages/core/src/index.ts
git commit -m "feat: 统一 tool 定义契约"
```

### Task 2: 实现 `bash` 风险识别与核心审批协调器

**Files:**
- Create: `packages/core/src/tools/bash-risk.ts`
- Create: `packages/core/src/tools/tool-approval.ts`
- Modify: `packages/core/src/tools/bash.ts`
- Modify: `packages/core/src/core-agent.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 实现 `bash` 高危命令识别器**

```ts
const HIGH_RISK_PATTERNS = [
  /\brm\s+-rf\b/,
  /\bsudo\b/,
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /\bchmod\s+-R\s+777\b/,
];

export function classifyBashCommand(command: string): ToolPermissionDecision {
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(command))) {
    return { mode: "ask", reason: "检测到高危 shell 操作", risk: "high" };
  }
  return { mode: "allow" };
}
```

- [ ] **Step 2: 实现审批协调器与待审批状态类型**

```ts
export interface PendingToolApproval {
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  reason: string;
  risk: "medium" | "high";
}

export class ToolApprovalCoordinator {
  private readonly pending = new Map<string, PendingToolApproval>();
}
```

- [ ] **Step 3: 在协调器中实现“单次批准/拒绝”的 Promise 协作**

```ts
requestApproval(approval: PendingToolApproval): Promise<"approved" | "rejected"> {
  this.pending.set(approval.toolCallId, approval);
  return new Promise((resolve) => {
    this.resolvers.set(approval.toolCallId, resolve);
  });
}
```

- [ ] **Step 4: 在 `CoreAgent` 装配工具时注入协调器**

```ts
const approvalCoordinator = new ToolApprovalCoordinator();
const tools = createAllTools(this.cwd, options.websearch, options.todoStore, approvalCoordinator);
```

- [ ] **Step 5: 在工具包装层中实现“允许则执行、要求审批则等待、拒绝则返回错误结果”**

```ts
if (decision.mode === "ask") {
  const result = await coordinator.requestApproval({...});
  if (result === "rejected") {
    throw new Error("用户拒绝了本次工具调用");
  }
}
return execute(toolCallId, params, signal, onUpdate);
```

- [ ] **Step 6: 运行 core 构建验证**

Run: `pnpm --filter @willow/core run build`
Expected: 构建通过，`bash-risk.ts` 和 `tool-approval.ts` 被正确打包

- [ ] **Step 7: 提交**

```bash
git add packages/core/src/tools packages/core/src/core-agent.ts packages/core/src/index.ts
git commit -m "feat: 添加 tool 审批协调器"
```

### Task 3: 打通主进程、共享类型与 IPC 审批接口

**Files:**
- Modify: `app/work/src/shared/api.ts`
- Modify: `app/work/src/shared/constants.ts`
- Modify: `app/work/src/shared/hook/session.hook.ts`
- Modify: `app/work/src/preload/preload.ts`
- Create: `app/work/src/main/controllers/session/resolve.tool.approval.controller.ts`
- Modify: `app/work/src/main/service/agent.service.ts`
- Modify: `app/work/src/main/service/session.service.ts`

- [ ] **Step 1: 在共享类型中新增审批请求与审批决策结构**

```ts
export interface ToolApprovalRequest {
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  reason: string;
  risk: "medium" | "high";
  status: "pending" | "approved" | "rejected";
}

export interface ResolveToolApprovalRequest {
  sessionId: number;
  toolCallId: string;
  decision: "approved" | "rejected";
}
```

- [ ] **Step 2: 新增 IPC 常量和 session hook 方法**

```ts
export const RESOLVE_TOOL_APPROVAL = "RESOLVE_TOOL_APPROVAL";
```

```ts
resolveToolApproval(request: ResolveToolApprovalRequest): Promise<ResolveToolApprovalResponse>;
```

- [ ] **Step 3: 在 preload 中暴露 `resolveToolApproval`**

```ts
resolveToolApproval: async (request) => {
  const response = await ipcRenderer.invoke(RESOLVE_TOOL_APPROVAL, request);
  if (response.code !== 0 || !response.data) throw new Error(response.msg || "resolve failed");
  return response.data;
},
```

- [ ] **Step 4: 新建 controller，将 renderer 的批准/拒绝请求转发到 `SessionService`**

```ts
@IPC(RESOLVE_TOOL_APPROVAL)
async run(_event, request) {
  await this.sessionService.resolveToolApproval(request.sessionId, request.toolCallId, request.decision);
  return this.buildResponse({});
}
```

- [ ] **Step 5: 在 `SessionService` 中保存当前会话的审批状态，并把其合并进 `ActiveSessionStream`**

```ts
const current = this.activeSessionStreams.get(sessionId) ?? {
  messages: [],
  streamMessage: null,
  isStreaming: false,
  pendingToolCallIds: new Set<string>(),
  pendingApprovals: new Map<string, ToolApprovalRequest>(),
};
```

- [ ] **Step 6: 在 `AgentService` 创建 agent 时，把审批协调器与 `SessionService` 事件桥接起来**

```ts
approvalCoordinator.onPending((approval) => {
  this.sessionService.upsertPendingApproval(session.id, approval);
});

approvalCoordinator.onResolved((approval) => {
  this.sessionService.resolvePendingApproval(session.id, approval.toolCallId, approval.status);
});
```

- [ ] **Step 7: 运行 app 侧类型检查式构建**

Run: `pnpm --filter ./app/work run lint`
Expected: `oxlint src/` 通过，无新增未使用类型或控制器引用错误

- [ ] **Step 8: 提交**

```bash
git add app/work/src/shared app/work/src/preload app/work/src/main/controllers/session app/work/src/main/service
git commit -m "feat: 打通 tool 审批 IPC"
```

### Task 4: 更新 renderer 会话状态与审批动作

**Files:**
- Modify: `app/work/src/renderer/src/composables/useAgentMessages.ts`
- Modify: `app/work/src/renderer/src/pages/chat/Chat.vue`
- Modify: `app/work/src/renderer/src/pages/chat/session/Session.vue`
- Modify: `app/work/src/renderer/src/lib/ipc.ts`

- [ ] **Step 1: 在 `useAgentMessages.ts` 中新增审批状态容器**

```ts
interface AgentMessagesState {
  messages: AgentMessage[];
  streamMessage: AgentMessage | null;
  isStreaming: boolean;
  tools: any[];
  pendingToolCalls: Set<string>;
  toolApprovals: Map<string, ToolApprovalRequest>;
}
```

- [ ] **Step 2: 从 `activeStream` 初始化审批状态**

```ts
state.toolApprovals = new Map(
  (activeStream.toolApprovals ?? []).map((item) => [item.toolCallId, item]),
);
```

- [ ] **Step 3: 处理审批相关事件**

```ts
case "tool_approval_pending":
case "tool_approval_resolved":
  if (event.approval) {
    state.toolApprovals = new Map([...state.toolApprovals, [event.approval.toolCallId, event.approval]]);
  }
  break;
```

- [ ] **Step 4: 在聊天页把审批状态透传到消息组件**

```vue
<Session
  :tools="state.tools"
  :pending-tool-calls="state.pendingToolCalls"
  :tool-approvals="state.toolApprovals"
/>
```

- [ ] **Step 5: 预留批准/拒绝动作回调**

```ts
async function resolveToolApproval(toolCallId: string, decision: "approved" | "rejected") {
  await electronAPI.resolveToolApproval({ sessionId: sessionId.value, toolCallId, decision });
}
```

- [ ] **Step 6: 运行 renderer 侧 lint**

Run: `pnpm --filter ./app/work run lint`
Expected: 通过，Vue 侧无类型命名冲突

- [ ] **Step 7: 提交**

```bash
git add app/work/src/renderer/src/composables app/work/src/renderer/src/pages/chat
git commit -m "feat: 跟踪前端 tool 审批状态"
```

### Task 5: 改造 UI 工具渲染，支持单次批准/拒绝

**Files:**
- Modify: `packages/ui/src/components/AssistantMessage.vue`
- Modify: `packages/ui/src/components/ToolMessage.vue`
- Create: `packages/ui/src/components/ToolApprovalActions.vue`
- Modify: `packages/ui/src/renderers/BashToolRenderer.vue`
- Modify: `packages/ui/src/renderers/CoreToolRenderer.vue`
- Modify: `packages/ui/src/renderers/types.ts`
- Modify: `packages/ui/src/renderers/registry.ts`

- [ ] **Step 1: 为 `ToolMessage` 增加审批信息与动作回调**

```ts
defineProps<{
  toolCall: ToolCall;
  tool?: AgentTool;
  result?: ToolResultMessage;
  approval?: ToolApprovalRequest;
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string) => void;
}>();
```

- [ ] **Step 2: 新增审批操作组件**

```vue
<template>
  <div class="flex gap-2">
    <button @click="$emit('approve')">批准本次执行</button>
    <button @click="$emit('reject')">拒绝本次执行</button>
  </div>
</template>
```

- [ ] **Step 3: 在 `AssistantMessage.vue` 中把 approval 与动作下发给 `ToolMessage`**

```vue
<ToolMessage
  :tool="part.data.tool"
  :tool-call="part.data.chunk"
  :result="part.data.result"
  :approval="toolApprovals?.get(part.data.chunk.id)"
  :on-approve="onApproveToolCall"
  :on-reject="onRejectToolCall"
/>
```

- [ ] **Step 4: 在 `BashToolRenderer.vue` 中展示高危提示和命令摘要**

```vue
<div v-if="approval?.status === 'pending'" class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
  这是高危操作，需要人工确认
</div>
```

- [ ] **Step 5: 明确首版 UI 只提供单次批准/拒绝**

```vue
<ToolApprovalActions
  v-if="approval?.status === 'pending'"
  @approve="onApprove?.(toolCall.id)"
  @reject="onReject?.(toolCall.id)"
/>
```

- [ ] **Step 6: 运行 workspace lint 和 core/ui build**

Run: `pnpm lint`
Expected: 根目录 `oxlint` 通过

Run: `pnpm --filter @willow/core run build`
Expected: 通过，UI 类型引用未破坏 workspace 构建

- [ ] **Step 7: 提交**

```bash
git add packages/ui/src app/work/src/renderer/src
git commit -m "feat: 支持 tool 单次批准与拒绝"
```

### Task 6: 端到端验证与收尾

**Files:**
- Modify: `openspec/changes/change-tool-design/tasks.md`
- Modify: `openspec/changes/change-tool-design/design.md`（仅在实现与设计不一致时）

- [ ] **Step 1: 手动验证低风险工具直通**

Run: `pnpm dev`
Expected: 启动 Electron 应用并进入聊天页

在聊天中输入：`帮我读取 README.md 并列出根目录文件`
Expected: `read` / `ls` 直接执行，不出现审批卡片

- [ ] **Step 2: 手动验证 `bash` 低风险命令直通**

在聊天中输入：`用 bash 执行 pwd`
Expected: `bash` 直接执行，不出现审批卡片

- [ ] **Step 3: 手动验证 `bash` 高危命令进入审批**

在聊天中输入：`用 bash 执行 rm -rf /tmp/test-dir`
Expected: 聊天中出现带风险提示的审批卡片，且命令在点击按钮前不会执行

- [ ] **Step 4: 验证单次批准/拒绝语义**

先拒绝上一步的高危命令，再重新发送同一条消息
Expected: 第二次仍然需要重新审批，说明授权没有跨调用记忆

- [ ] **Step 5: 运行最终静态检查**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm --filter @willow/core run build`
Expected: PASS

- [ ] **Step 6: 回填 OpenSpec 任务完成状态**

```md
- [x] 1.1 ...
- [x] 1.2 ...
```

- [ ] **Step 7: 最终提交**

```bash
git add openspec/changes/change-tool-design/tasks.md
git commit -m "feat: 完成 tool 权限审批首版"
```

## Self-Review

- **Spec coverage:** `tool-definition-contract` 对应 Task 1；`tool-permission-control` 与 `bash-high-risk-approval` 对应 Task 2、3、6；`tool-approval-ui` 对应 Task 4、5、6。无明显缺口。
- **Placeholder scan:** 已避免 `TODO`、`TBD`、`适当处理` 之类空泛描述；每个任务都给了明确文件、代码方向和命令。
- **Type consistency:** 计划统一使用 `ToolApprovalRequest`、`ResolveToolApprovalRequest`、`ToolApprovalCoordinator`、`toolApprovals`、`toolCallId` 这组命名，避免前后步骤漂移。
