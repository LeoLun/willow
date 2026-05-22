# 任务列表

## 1. 扩展通信与协调层

- [ ] 修改 `packages/core/src/tools/tool-approval.ts`
  - 更新 `requestApproval` 返回类型为 `Promise<{ decision: ToolApprovalDecision; reason?: string }>`
  - 在 `PendingToolApproval` 接口的 `resolve` 中接收 `reason?: string`
  - 调整 `resolve` 方法并将其传回 Promise resolve
- [ ] 修改 `packages/core/src/core-agent.ts`
  - 适配 `requestApproval` 返回结果的解构（从 `result` 变为 `{ decision, reason }`）
  - 清理/简化 `resolveToolApproval` 逻辑，移除私有的 `rejectionReasons` 属性

## 2. 新增 ask_user 工具

- [ ] 新建 `packages/core/src/tools/ask-user.ts`
  - 编写 `ask_user` 的参数 Schema，包含 `question` 和 `options` 字段，选项数限 2~4 个
  - 实现 `execute` 方法，在方法内调用 `approvalCoordinator.requestApproval` 等待用户回答
- [ ] 修改 `packages/core/src/tools/index.ts`
  - 导入并注册 `ask_user` 工具，在 `createAllTools` 选项中添加 `approvalCoordinator` 必填参数
- [ ] 修改 `packages/core/src/core-agent.ts` 的 `createAllTools` 调用处，正确传入 `this.approvalCoordinator`

## 3. UI 开发与重构

- [ ] 重命名并编写 `packages/ui/src/components/AskUserPanel.vue`（由原 `ArkUserPanel.vue` 修改而来）
  - 实现结构与样式：问题标题、候选项列表、输入框、跳过/提交按钮
  - 绑定交互逻辑，当用户进行选项点击或输入框提交时发出 `resolve` 事件，关闭或跳过发出 `close` / `resolve('rejected')`
- [ ] 修改 `packages/ui/src/index.ts`，导出 `AskUserPanel` 替换原 `ArkUserPanel`

## 4. 页面集成与联调

- [ ] 修改 `app/work/src/renderer/src/pages/chat/Chat.vue`
  - 计算 `pendingAskUser`（特定 `ask_user` 工具的 pending 状态）
  - 从 `pendingApprovals` 中排除 `ask_user` 工具调用
  - 模板中集成 `<AskUserPanel>` 组件，并在有提问时覆盖输入框区域
- [ ] 运行 lint 和类型检查，确保项目成功编译：
  - `pnpm lint`
  - `pnpm build`

## 5. 效果验证

- [ ] 验证在 AI 执行过程中，调用 `ask_user` 能在主会话中正常弹出选项面板
- [ ] 验证选择不同选项、手动输入和点击“跳过/关闭”后，AI 均能获取相应的输入值并继续运行
