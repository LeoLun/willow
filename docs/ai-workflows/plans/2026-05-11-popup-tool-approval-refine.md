# 实现计划：审批面板精修

日期：2026-05-11 | 变更：`popup-tool-approval`（精修）

## 范围

对已实现的 `PermissionApprovalPanel.vue` 做两处修改，其余文件不动。

## Slice 1：标题生成规则

**目标**：标题从原始 `approval.reason` 改为统一格式 `"是否允许执行 <操作摘要>"`

**文件**：`packages/ui/src/components/PermissionApprovalPanel.vue`

**实现**：

1. 新增 `approvalTitle` computed，根据 `approvals[0]` 的工具类型生成标题：
   ```
   bash   → approval.arguments.command → "是否允许执行 rm -rf a.js"
   write  → approval.arguments.filePath → "是否允许执行写入 /path/to/file"
   edit   → approval.arguments.filePath → "是否允许执行编辑 /path/to/file"
   其他   → 工具名 + JSON.stringify(arguments) → "是否允许执行 <toolName> ..."
   ```
2. 模板中 `{{ approvals[0]?.reason ... }}` 替换为 `{{ approvalTitle }}`
3. 如果没有 pending 审批（防御），fallback 为 `"工具调用等待审批"`

**停止条件**：标题按工具类型展示正确格式。

## Slice 2：行交互模式

**目标**：行内移除"允许"按钮，整行可点击即批准

**文件**：`packages/ui/src/components/PermissionApprovalPanel.vue`

**实现**：

1. 删除 `<Button variant="ghost" ... @click="emit('approve', ...)">允许</Button>`
2. 在 `<div class="flex h-16 items-center gap-[14px]">`（choiceRow）上添加：
   - `@click="emit('approve', approval.toolCallId)"`
   - `class="cursor-pointer hover:bg-muted/30 rounded-[7px]"`
3. 行内只保留：编号徽章 + "允许" 文字（`<span class="text-[15px] text-foreground">允许</span>`）

**停止条件**：点击行的任意位置触发 approve，行内无额外按钮。

## Slice 3：验证

- `pnpm lint` → 0 errors
- `pnpm format` → 通过
- `npx tsgo --noEmit -p app/work/tsconfig.json` → 无类型错误
