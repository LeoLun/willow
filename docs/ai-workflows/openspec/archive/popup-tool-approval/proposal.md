# 弹出式工具权限审批

## 概述

将工具调用权限审批从消息流内的内联卡片，改为底部弹出式面板。面板出现时直接替换输入框区域，宽度与输入框保持一致。同时预留 `arkUser` 工具审批的 UI 位置。

## 动机

当前审批 UI 内嵌在 `ToolMessage.vue` 的消息流中，存在以下问题：

1. **打断阅读流**：审批卡片出现在消息历史中间，用户在上下文中查找审批信息不便
2. **视觉层级不清晰**：审批操作与普通消息内容混在一起，区分度不够
3. **操作位置不符合习惯**：用户通常在底部输入框区域进行操作，审批按钮应该出现在同一视觉区域

## 范围

- 新建 `PermissionApprovalPanel.vue` 组件，按 `ui/work.pen` 中 `askPermPanel` 的设计还原
- 修改 `Chat.vue` 底部区域，有 pending 审批时用审批面板替换 SenderContainer
- 简化 `ToolMessage.vue` 中的审批 UI，仅保留已审批状态显示
- 点击"跳过"或"关闭"按钮时，**自动停止当前会话**（拒绝所有 pending 审批 + 调用 `stopSessionStream`）
- 预留 `ArkUserPanel.vue` 组件位置，与审批面板效果一致
- 不改变审批后端逻辑（`ToolApprovalCoordinator`、IPC 通信保持不动）

## 非目标

- 不修改 `arkUser` 工具的后端逻辑（仅预留 UI）
- 不修改审批决策流程
- 不改变消息存储和恢复逻辑
