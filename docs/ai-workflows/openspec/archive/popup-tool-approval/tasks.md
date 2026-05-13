# 任务清单

## 1. 创建 PermissionApprovalPanel 组件

- [x] 1.1 使用 Pencil MCP 工具读取 `ui/work.pen` 中 `askPermPanel`（id: `oZAzQ`）完整节点树
- [x] 1.2 在 `packages/ui/src/components/` 下创建 `PermissionApprovalPanel.vue`
- [x] 1.3 实现 header（标题 + 关闭按钮），标题使用统一格式 `"是否允许执行 <操作摘要>"`，参数以 `.pen` 实际值为准
- [x] 1.4 实现 choiceList（编号徽章 + "允许"文字，行整体可点击=批准，无额外按钮），参数以 `.pen` 实际值为准
- [x] 1.5 实现 footer（自定义拒绝区域 + 跳过按钮），参数以 `.pen` 实际值为准
- [x] 1.6 实现审批操作 emits（approve、reject、skip、close）
- [x] 1.7 审批标题由 tool 端统一提供，UI 组件不再针对每种 tool 特殊处理

## 2. 创建 ArkUserPanel 骨架组件

- [x] 2.1 在 `packages/ui/src/components/` 下创建 `ArkUserPanel.vue`
- [x] 2.2 复用 PermissionApprovalPanel 的结构（header/choiceList/footer 布局）
- [x] 2.3 内容标记为 TODO 占位，添加 `// TODO: 待 arkUser 工具实现后接入`

## 3. 修改 Chat.vue 底部区域

- [x] 3.1 从 `state.toolApprovals` 计算 `pendingApprovals`
- [x] 3.2 有 pending 审批时，用 PermissionApprovalPanel 替换 SenderContainer
- [x] 3.3 approve/reject 事件绑定到已有的 `handleToolApproval` 方法
- [x] 3.4 skip/close 事件处理：拒绝所有 pending 审批 → 调用 `handleStop()` 停止会话
- [x] 3.5 无 pending 审批时，恢复显示 SenderContainer

## 4. 简化 ToolMessage 审批 UI

- [x] 4.1 移除 ToolMessage.vue 中的内联审批按钮（批准/拒绝）
- [x] 4.2 保留已审批状态文字显示（"本次调用已批准"/"本次调用已拒绝"）

## 5. 更新包导出

- [x] 5.1 在 `packages/ui/src/index.ts` 中导出 `PermissionApprovalPanel` 和 `ArkUserPanel`
- [x] 5.2 验证类型检查和 lint 通过

## 6. 自定义拒绝原因透传

- [x] 6.1 `PermissionApprovalPanel.vue`："否"区域点击切换内联输入框，Enter/确认 emit `reject(id, reason)`
- [x] 6.2 `api.ts`：`ResolveToolApprovalRequest` 加 `reason?: string`
- [x] 6.3 `resolve.tool.approval.controller.ts`：透传 `reason` 到 SessionService
- [x] 6.4 `session.service.ts`：`resolveToolApproval` 透传 `reason` 到 CoreAgent
- [x] 6.5 `core-agent.ts`：存储 `rejectionReason`，拒绝时返回自定义原因

## 7. 视觉验证

- [x] 7.1 运行 `pnpm dev:ui` 验证审批面板视觉效果
- [x] 7.2 运行 `pnpm dev` 在完整 app 中验证审批触发流程
