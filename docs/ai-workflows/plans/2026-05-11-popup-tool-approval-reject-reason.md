# 实现计划：自定义拒绝原因透传

日期：2026-05-11 | 变更：`popup-tool-approval`（拒绝原因透传）

## 数据流

```
UI input → emit('reject', id, reason)
  → Chat.vue handleToolApproval(id, 'rejected', reason)
    → electronAPI.resolveToolApproval({ sessionId, toolCallId, decision, reason })
      → IPC → Controller → SessionService → CoreAgent.resolveToolApproval(id, decision, reason)
        → core-agent 存储 rejectionReasons.set(id, reason)
          → setBeforeToolCall 返回 { block: true, reason: reason || "用户拒绝了本次工具调用" }
```

## Slice 1：类型 + 传递链（5 文件，从上到下）

### 1a. `app/work/src/shared/api.ts`
```typescript
export interface ResolveToolApprovalRequest {
  sessionId: number;
  toolCallId: string;
  decision: "approved" | "rejected";
  reason?: string;  // 新增
}
```

### 1b. `app/work/src/main/controllers/session/resolve.tool.approval.controller.ts`
`sessionService.resolveToolApproval()` 调用新增第 4 个参数：
```typescript
await this.sessionService.resolveToolApproval(
  request.sessionId,
  request.toolCallId,
  request.decision,
  request.reason,  // 新增
);
```

### 1c. `app/work/src/main/service/session.service.ts`
`resolveToolApproval` 方法签名新增 `reason?: string` 参数，透传到 `coreAgent`：
```typescript
async resolveToolApproval(
  sessionId: number,
  toolCallId: string,
  decision: ToolApprovalDecision,
  reason?: string,  // 新增
): Promise<void> {
  // ...
  const resolved = runningSession.coreAgent.resolveToolApproval(toolCallId, decision, reason);
}
```

`RunningSession` 接口中 `resolveToolApproval` 签名同步更新。

### 1d. `packages/core/src/core-agent.ts`
```typescript
private rejectionReasons = new Map<string, string>();

resolveToolApproval(toolCallId: string, decision: "approved" | "rejected", reason?: string): boolean {
  if (reason) {
    this.rejectionReasons.set(toolCallId, reason);
  }
  return this.approvalCoordinator.resolve(toolCallId, decision);
}
```

`setBeforeToolCall` 拒绝时使用存储的原因：
```typescript
if (result === "approved") {
  return undefined;
}
const customReason = this.rejectionReasons.get(toolCall.id);
this.rejectionReasons.delete(toolCall.id);
return {
  block: true,
  reason: customReason ?? "用户拒绝了本次工具调用",
};
```

### 1e. `app/work/src/renderer/src/pages/chat/Chat.vue`
`handleToolApproval` 加 `reason` 参数：
```typescript
async function handleToolApproval(toolCallId: string, decision: "approved" | "rejected", reason?: string) {
  await electronAPI.resolveToolApproval({
    sessionId: sessionId.value,
    toolCallId,
    decision,
    reason,
  });
}
```

**验证**：`tsgo --noEmit -p app/work/tsconfig.json` 无类型错误。

## Slice 2：UI 交互（1 文件）

### 2a. `packages/ui/src/components/PermissionApprovalPanel.vue`

Footer "否"区域改造：

```typescript
// 新增状态
const isRejectInputVisible = ref(false);
const rejectReason = ref("");

function openRejectInput() {
  isRejectInputVisible.value = true;
  rejectReason.value = "";
}

function confirmReject(toolCallId: string) {
  emit("reject", toolCallId, rejectReason.value || undefined);
  isRejectInputVisible.value = false;
}

function cancelReject() {
  isRejectInputVisible.value = false;
  rejectReason.value = "";
}
```

模板 footer "否"区域：
```html
<!-- 默认状态 -->
<template v-if="!isRejectInputVisible">
  <div class="flex flex-1 items-center gap-3 cursor-pointer" @click="openRejectInput">
    <div class="flex size-7 ..."><Pencil .../></div>
    <span class="text-[15px] text-muted-foreground">否</span>
  </div>
</template>
<!-- 激活状态 -->
<template v-else>
  <div class="flex flex-1 items-center gap-2">
    <input
      ref="rejectInputRef"
      v-model="rejectReason"
      class="flex-1 h-7 rounded-[7px] border bg-muted/50 px-2 text-[13px] text-foreground outline-none"
      placeholder="输入拒绝原因..."
      @keydown.enter="confirmReject(approvals[0].toolCallId)"
      @keydown.escape="cancelReject"
    />
    <Button variant="ghost" size="icon-sm" class="size-7" @click="confirmReject(approvals[0].toolCallId)">
      <Check class="size-3.5" />
    </Button>
  </div>
</template>
```

注意：多个待审批项时，"否"对应第一个审批；每次只拒绝一个。

**验证**：`pnpm lint` + `pnpm format` 通过。

## Slice 3：构建 + 验证

- `cd packages/core && npx tsup` 重新编译
- `pnpm format:check` → 通过
- `npx tsgo --noEmit -p tsconfig.json && npx tsgo --noEmit -p app/work/tsconfig.json` → 无错误
- `pnpm lint` → 0 errors
