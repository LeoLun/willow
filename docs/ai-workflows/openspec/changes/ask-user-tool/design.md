# 设计文档：ask_user 工具

## 架构决策

### 1. 通信与机制扩展

为了能够让工具 `execute` 阻塞等待用户在前端的响应，并把该响应原样返回给 AI，我们需要打通整个审批通信机制。

#### A. 修改 `ToolApprovalCoordinator` (`packages/core/src/tools/tool-approval.ts`)
- 将 `requestApproval` 返回的 `Promise<ToolApprovalDecision>` 更改为 `Promise<{ decision: ToolApprovalDecision; reason?: string }>`。
- 修改 `PendingToolApproval` 接口的 `resolve` 签名，允许在 resolve 时接收 `reason?: string` 并作为 Promise 的一部分解析返回。
- 调整 `resolve` 方法，将 `reason` 传递给 Promise 的 resolve 回调。

#### B. 修改 `CoreAgent` (`packages/core/src/core-agent.ts`)
- 适配 `requestApproval` 返回对象类型的变化。在 `beforeToolCall` 中，从 `result.decision === "approved"` 来进行授权判断，拒绝理由使用 `result.reason`。
- 修改 `resolveToolApproval`，使之能直接将 `reason` 传递给 `approvalCoordinator.resolve`。

### 2. 工具实现

#### `ask_user` 工具 (`packages/core/src/tools/ask-user.ts`)
- 定义参数 Schema，要求包含 `question` (string) 和 `options` (array of string)。
- 限制 `options` 为 2~4 个候选项。
- 其 `execute` 实现为：
  ```typescript
  async execute(toolCallId, params, signal) {
    const result = await approvalCoordinator.requestApproval({
      toolCallId,
      toolName: "ask_user",
      arguments: params,
      title: params.question,
      reason: "",
      risk: "medium"
    }, signal);

    if (result.decision === "approved") {
      return {
        content: [{ type: "text", text: result.reason || "用户未提供具体回答" }]
      };
    } else {
      return {
        content: [{ type: "text", text: "用户跳过了该问题或未作答。" }]
      };
    }
  }
  ```

### 3. UI 设计

我们将 `ArkUserPanel.vue` 重命名并重构为 `AskUserPanel.vue`，使其结构与 `PermissionApprovalPanel.vue` 呼应，具有以下 UI 细节：
- 使用 HSL 基础颜色和圆角。
- 外层阴影：`box-shadow: 0 10px 28px rgba(0, 0, 0, 0.078)`。
- 选项卡悬停高亮：`hover:bg-muted/30`，点击直接提交对应的选项值。
- 自定义输入框按回车或者右下角“提交”触发 `emit('resolve', 'approved', text)`。
- 右下角“跳过”或顶部关闭 `X` 图标触发 `emit('resolve', 'rejected')`。

### 4. 页面集成 (`app/work/src/renderer/src/pages/chat/Chat.vue`)

- 定义计算属性 `pendingAskUser`，从 `state.toolApprovals` 中过滤出 `toolName === 'ask_user' && status === 'pending'` 的第一个审批项。
- 定义普通审批列表 `pendingApprovals`，过滤掉 `toolName === 'ask_user'` 的项。
- 在 `Chat.vue` 的模板里，使用 `v-if` 条件渲染：
  ```html
  <AskUserPanel
    v-if="pendingAskUser"
    :approval="pendingAskUser"
    @resolve="(decision, answer) => handleToolApproval(pendingAskUser.toolCallId, decision, answer)"
    @close="handleToolApproval(pendingAskUser.toolCallId, 'rejected')"
  />
  <PermissionApprovalPanel
    v-else-if="pendingApprovals.length > 0"
    ...
  />
  <SenderContainer
    v-else
    ...
  />
  ```
- 此设计确保了提问交互和权限审批都能优雅地互斥展示，不会重叠冲突，并且最大程度地复用了现有的 `handleToolApproval` 逻辑。
