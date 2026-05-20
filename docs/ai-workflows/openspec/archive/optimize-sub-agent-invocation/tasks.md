# 任务列表：子 Agent 委派功能优化

## 1. 基础设施与工具定义

- [ ] 1.1 创建工具定义文件 `app/work/src/main/service/tools/workspace-delegate.tool.ts`
  - 使用 `@sinclair/typebox` 定义参数 Schema: `workspaceId`, `task`, `sessionId`
  - 实现 `createWorkspaceDelegateTool(parentSessionId, handler)` 创建 `workspace_delegate` 工具
- [ ] 1.2 在 `packages/core/src/tools/index.ts` 或对应位置导出该工具（若有需要），或在 `app/work` 主进程直接引入

## 2. 运行时回调注册与 Agent 整合

- [ ] 2.1 修改 `app/work/src/main/service/agent.service.ts`
  - 声明 `WorkspaceDelegateHandler` 类型
  - 新增 `registerWorkspaceDelegateHandler(handler)` 方法
  - 在 `getDefaultAgent` 中，将 `workspace_delegate` 工具添加到 `extraTools` 中（需传入 `session.id`）
  - 如果传入了明确的 `targetWorkspaceId`（用户手动选择了工作空间 Agent），则向系统提示词追加强指令提示，强制 LLM 调用该工具进行任务下发。
- [ ] 2.2 修改 `app/work/src/main/service/session.service.ts`
  - 在构造函数或 `onInit` 中调用 `agentService.registerWorkspaceDelegateHandler` 注册委派处理函数。
  - 实现 `runWorkspaceDelegate` 核心逻辑：
    - 根据 `workspaceId` 校验工作空间，并解析 Agent 名字
    - 处理 `sessionId` 的复用逻辑。若传入了 `sessionId` 且对应的 Session 合法（属于该工作空间），则复用该 Session；否则新建一个
    - 创建子 Session 时更新其标题为 `task` 缩影
    - 获取当前父 Session 的活跃 stream。遍历其中的 assistant 消息内容，找到当前正在运行的 toolCall 并把 `childSessionId` 追加到参数 arguments 中，然后通过 `eventService` 推送 `UPDATE_MESSAGE` 状态事件，使得前端立刻感知到 `childSessionId`
    - 执行子 Agent：`executeAgentSession`，并将审批流 `forwardApprovalsToParentSessionId` 转发到父 Session。
    - 将子 Agent 的最终流式输出作为 Tool 结果的 content text 返回；并在 details 中带上 `childSessionId`、`workspaceId`、`workspaceName`、`agentName` 和最终状态。
- [ ] 2.3 修改 `app/work/src/main/service/session.service.ts` 中的 `sendMessage` 方法
  - 移除顶层针对 Conversation 和 `targetWorkspaceId` 存在时的直接拦截退出逻辑。使委派任务逻辑自然流向主 Agent，由主 Agent 通过 Tool Call 进行委派调用。

## 3. 前端 UI 重构

- [ ] 3.1 修改 `packages/ui/src/renderers/WorkspaceDelegateToolRenderer.vue`
  - 移除嵌套在 `#summary` 插槽中的 Markdown 卡片和“查看子会话”按钮。
  - 将 `title` 保持为委派对象（如 `委派「账单管理 / bill-app」`）。
  - 在 `#summary` 插槽中仅放置当前状态提示文字，如 `正在委派执行中...`（运行态）或 `委派已完成`（完成态）等。
  - 在 `#details` 插槽中组织展开后的详情布局：
    - 使用 `bg-muted/20 border border-border/50 rounded-lg p-3.5 flex flex-col gap-3` 作为卡片内衬
    - 引入并使用 `MarkdownBlock` 渲染子 Agent 的返回摘要 `summaryText`
    - 新增精致的状态行，带有 pulsing 绿点或 Lucide 状态图标（`CheckCircle2` / `XCircle` / `Loader2`）
    - 渲染“查看子会话”的 `Button`（基于 shadcn 样式，带有 `ArrowRight` 图标），支持跳转操作，并伴有提示文字。
    - 保证在 `state === 'running'` 时，只要从参数中读取到 `childSessionId`（主进程动态写入的），按钮也可用且能跳转。

## 4. 验证

- [ ] 4.1 运行 `pnpm lint` 确保语法检查无报错
- [ ] 4.2 运行 `pnpm build` 确保各包能正常构建
- [ ] 4.3 手动运行 `pnpm dev` 验证：
  - 在对话空间下发送消息并指定特定工作空间 Agent（例如 @bill-app），确认主 Agent 启动并正确触发 `workspace_delegate` 工具卡片。
  - 卡片在运行中即点亮“查看子会话”按钮，点击能顺畅跳转至对应的子会话，且子会话能看到正在执行的流程。
  - 子 Agent 执行完成后，卡片切换为完成态，展开折叠面板，能以 Markdown 格式（表格、列表）正常浏览子 Agent 运行的最后结果。
  - 主 Agent 能接收到该回调结果，并向用户发送总结发言。
  - 发起二次委派对话（多轮），验证主 Agent 记住了 `sessionId` 并能传递给工具，确保在同一个子会话中接着交谈。
