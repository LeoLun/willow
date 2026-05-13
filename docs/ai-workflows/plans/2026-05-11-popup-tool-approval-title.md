# 实现计划：审批标题由 Tool 端统一提供

日期：2026-05-11 | 变更：`popup-tool-approval`（title 解耦）

## 目标

`approvalTitle` 不再由 UI 组件根据 tool 类型特殊处理，改为由各 tool 的 permission resolver 生成 `title`，沿数据链路传递到 UI。

## 数据链路（改 5 层）

```
ToolPermissionDecision.ask  →  ToolApprovalRequest  →  ToolApproval (shared API)  →  IPC  →  UI
         ↑ 加 title                  ↑ 加 title             ↑ 加 title                   ↑ 直接用
```

## Slice 1：类型定义层（3 文件并行改）

### 1a. `packages/core/src/tools/create-tool.ts`
`ToolPermissionDecision` 的 `ask` 分支新增 `title` 字段：
```typescript
export type ToolPermissionDecision =
  | { mode: "allow" }
  | { mode: "ask"; title: string; reason: string; risk: ToolPermissionRisk };
```

### 1b. `packages/core/src/tools/tool-approval.ts`
`ToolApprovalRequest` 新增 `title` 字段：
```typescript
export interface ToolApprovalRequest {
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  title: string;
  reason: string;
  risk: ToolPermissionRisk;
  status: ToolApprovalStatus;
}
```

### 1c. `app/work/src/shared/api.ts`
`ToolApproval` 新增 `title` 字段：
```typescript
export interface ToolApproval {
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  title: string;
  reason: string;
  risk: "medium" | "high";
  status: "pending" | "approved" | "rejected";
}
```

**验证**：`tsgo --noEmit` 确认无类型错误（此时应有缺失 `title` 的报错，由后续 slice 补齐）。

## Slice 2：Tool 端生成 title（3 文件并行改）

### 2a. `packages/core/src/tools/bash.ts`
permission resolver 返回时生成 `title`：
```typescript
permission: (params) => {
  const classification = classifyBashCommand(params.command);
  if (classification.mode === "ask") {
    return { ...classification, title: `是否允许执行 ${params.command}` };
  }
  return classification;
}
```
检查 `bash-risk.ts` 的 `classifyBashCommand` 返回类型，确认其返回 `ToolPermissionDecision`。若其内部已构造 `{ mode: "ask", reason, risk }`，则在上层包装 `title`。

### 2b. `packages/core/src/tools/write.ts`
```typescript
permission: (params) =>
  isPathInsideCwd(params.path, cwd)
    ? { mode: "allow" }
    : { mode: "ask", title: `是否允许执行 写入 ${params.path}`, reason: "写入文件会修改工作区内容", risk: "high" },
```

### 2c. `packages/core/src/tools/edit.ts`
```typescript
permission: (params) =>
  isPathInsideCwd(params.path, cwd)
    ? { mode: "allow" }
    : { mode: "ask", title: `是否允许执行 编辑 ${params.path}`, reason: "编辑文件会修改工作区内容", risk: "high" },
```

**验证**：各文件 permission resolver 返回的 ask 对象包含 `title`。

## Slice 3：传递层（2 文件）

### 3a. `packages/core/src/core-agent.ts`
`setBeforeToolCall` 中调用 `requestApproval` 时传入 `title`：
```typescript
const result = await this.approvalCoordinator.requestApproval(
  {
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    arguments: args,
    title: decision.title,
    reason: decision.reason,
    risk: decision.risk,
  },
  signal,
);
```

### 3b. `packages/ui/src/components/PermissionApprovalPanel.vue`
- 删除 `approvalTitle` computed 和 `computed` import
- 删除 `argsPreview` function（如果只被 computed 使用；检查模板仍在使用）
- 模板标题改为 `{{ approvals[0]?.title || "工具调用等待审批" }}`
- 内部的 `ToolApproval` interface 新增 `title: string`

**验证**：类型检查无错误，`title` 字段不再缺失。

## Slice 4：验证

- `pnpm lint` → 0 errors
- `pnpm format` → 通过
- `npx tsgo --noEmit -p tsconfig.json` → 无类型错误
- `npx tsgo --noEmit -p app/work/tsconfig.json` → 无类型错误
- 全文搜索确认无 `ToolPermissionDecision` 的 `ask` 构造遗漏 `title`

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/core/src/tools/create-tool.ts` | 修改 | `ToolPermissionDecision.ask` 加 `title` |
| `packages/core/src/tools/tool-approval.ts` | 修改 | `ToolApprovalRequest` 加 `title` |
| `app/work/src/shared/api.ts` | 修改 | `ToolApproval` 加 `title` |
| `packages/core/src/tools/bash.ts` | 修改 | permission 返回 `title` |
| `packages/core/src/tools/bash-risk.ts` | 可能需要修改 | 确认返回类型兼容 |
| `packages/core/src/tools/write.ts` | 修改 | permission 返回 `title` |
| `packages/core/src/tools/edit.ts` | 修改 | permission 返回 `title` |
| `packages/core/src/core-agent.ts` | 修改 | 传递 `title` 到 `requestApproval` |
| `packages/ui/src/components/PermissionApprovalPanel.vue` | 修改 | 删除 `approvalTitle` computed，直接用 `title` |
