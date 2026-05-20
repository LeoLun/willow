# 子 Agent 委派重构与优化 — 执行计划

## 1. 依赖关系

```
1.1 (工具定义) ──→ 2.1 (注册回调于 Agent) ──→ 2.2 (执行细节与会话回传)
                                              ↓
3.1 (UI 卡片重构) ←─────────────────────────── 2.3 (清理 sendMessage 拦截)
   ↓
4.1/4.2 (编译与语法检查) ──→ 4.3 (人工场景验证)
```

---

## 2. 任务细分

### 任务 1：子 Agent 委派工具定义

#### 1.1 新建 `app/work/src/main/service/tools/workspace-delegate.tool.ts`
- 引入 `@sinclair/typebox` 和 `@willow/core`。
- 定义 `workspaceDelegateSchema`，包含 `workspaceId` (number)、`task` (string) 和可选的 `sessionId` (number)。
- 实现 `createWorkspaceDelegateTool(parentSessionId, handler)`，返回 `createTool` 的结果。
- 在 `execute` 方法中接收 `(toolCallId, params)` 并解构传递给 `handler`，混入 `toolCallId`。

---

### 任务 2：主进程服务融合

#### 2.1 修改 `app/work/src/main/service/agent.service.ts`
- 导入 `createWorkspaceDelegateTool` 极其 schema。
- 在 `AgentService` 中增加私有属性 `workspaceDelegateHandler?: WorkspaceDelegateHandler`，并暴露 `registerWorkspaceDelegateHandler(handler: WorkspaceDelegateHandler)` 方法。
- 在 `getDefaultAgent` 中：
  - 解构 `session` 得到 `session.id`，并在 `extraTools` 中加入 `createWorkspaceDelegateTool(session.id, this.workspaceDelegateHandler!)`。
  - 获取 `targetWorkspaceId`。如果用户在前端指定了目标工作空间（例如 `selectedWorkspaceAgent` 存在），则向系统提示词（`systemPromptOverrides`）最后追加强指令强迫主 Agent 调用该工具指派任务：
    ```markdown
    用户明确指定了目标工作空间 Agent（ID: ${targetWorkspaceId}）。你必须调用 `workspace_delegate` 工具，将用户的提问指派给该工作空间 Agent。禁止直接回答或使用其他工具。
    ```

#### 2.2 修改 `app/work/src/main/service/session.service.ts`
- 导入 `WorkspaceDelegateHandler`。
- 在 `SessionService` 构造函数最后，向 `agentService` 注册处理器：
  ```typescript
  this.agentService.registerWorkspaceDelegateHandler((params) =>
    this.runWorkspaceDelegate(params),
  );
  ```
- 实现 `runWorkspaceDelegate` 方法：
  - 校验 `workspaceId` 对应工作空间存在，并获取其 `name` 和 `agentName`。
  - 对比并复用/新建子会话。若有传入 `sessionId` 并且匹配 `workspaceId`，则直接复用；否则调用 `this.createSession(workspaceId)`。
  - 修改新会话标题：`void this.createSessionTitle(childSession.id, task)`。
  - 动态在父会话活跃流消息中追加 `childSessionId`。查找 `this.activeSessionStreams.get(parentSessionId)` 并修改对应 `toolCallId` 的 `arguments`，然后发送 `UPDATE_MESSAGE` 广播给前端，使前端能在任务刚运行便获取 `childSessionId`。
  - 使用 `executeAgentSession` 运行子 Agent，传入参数将 `forwardApprovalsToParentSessionId` 设置为 `parentSessionId` 以合并审批流。
  - 正常执行后，返回包含 `childSessionId` 等细节的结构体：
    ```typescript
    return {
      content: [{ type: "text", text: `委派执行已完成。子会话 ID: ${childSession.id}。\n执行结果如下：\n${childResult?.text}` }],
      details: {
        childSessionId: childSession.id,
        workspaceId,
        workspaceName,
        agentName,
        status: "completed",
        summary: childResult?.text || "未返回结果",
      }
    };
    ```
  - `catch` 异常后返回 `status: "failed"` 的细节信息结构体，不直接崩掉主会话流。

#### 2.3 清理 `sendMessage` 拦截
- 修改 `app/work/src/main/service/session.service.ts` 中的 `sendMessage` 方法。
- 删除第 262-277 行的拦截代码：
  ```typescript
  if (chatScope === "conversation" && targetWorkspaceId) { ... }
  ```
- 从而让指派了 `targetWorkspaceId` 的消息能正常进入主 Agent 流，触发 `workspace_delegate` 工具调用。

---

### 任务 3：前端 UI 重构

#### 3.1 修改 `packages/ui/src/renderers/WorkspaceDelegateToolRenderer.vue`
- 检查组件当前结构，调整其插槽用法：
  - 仅保留 `stateLabel` 或在 `#summary` 插槽中显示单行状态，去除折叠触发器内的所有其他按钮与大段文本。
  - 新增 `#details` 插槽。
  - `#details` 内部增加卡片内衬容器 `bg-muted/20 border border-border/50 rounded-lg p-3.5 flex flex-col gap-3`。
  - 渲染状态行，通过 Lucide 图标标识状态：完成（`CheckCircle2` 绿标）、失败（`XCircle` 红标）、运行中（`Loader2` 旋转动画）。
  - 渲染 Markdown 执行结果：使用导入的 `MarkdownBlock` 组件渲染 `summaryText`。
  - 渲染底部的操作栏：
    ```html
    <Button variant="outline" size="sm" class="w-fit" :disabled="!childSessionId" @click="handleNavigate">
      <ArrowRight class="mr-2 size-3.5" />
      查看子会话
    </Button>
    <span class="text-[11px] text-muted-foreground">跳转到该工作空间的独立会话中查看完整上下文与执行日志</span>
    ```
  - 点击“查看子会话”时，调用 `props.onNavigateToSession(childSessionId)`，并使用 `.stop` 阻止冒泡以防止卡片折叠。
  - 数据获取优化：`childSessionId` 的获取支持从 `parsedParams.value.childSessionId`（运行时动态注入）和 `details.value.childSessionId`（执行完毕返回）中读取。

---

## 4. 验证

### 4.1 静态检查与编译
- 运行 `pnpm lint` 执行 oxlint 校验，确保无未处理的 TypeScript 类型或语法报错。
- 运行 `pnpm build` 重新编译 packages 与 app。

### 4.2 人工验证流程
1. 在前端会话侧边栏切换至对话空间。
2. 在输入框点击 @ 或从下拉菜单中选中特定工作空间 Agent（例如 `@bill-app`），输入“帮我分析账单数据”。
3. 点击发送，确认主会话工具卡片出现，展示状态为 `正在委派执行中...`。
4. 确认此时“查看子会话”按钮可点击。点击跳转至对应的子会话，验证子会话确实存在且正在正常处理账单数据。
5. 等待子 Agent 流式处理完成。回到主会话，确认卡片状态转为 `委派已完成`。
6. 点击折叠面板展开卡片，验证：
   - 内部排版是漂亮的 Markdown 格式（表格线、粗体等渲染完美）。
   - “查看子会话”按钮位置合理且点击仍可跳转。
   - 主 Agent 收到了回调文本并做出了最终的总结性回答。
7. 在主会话中发送 follow-up 消息：“用表格把其中大额支出再列一下”。
8. 确认主 Agent 再次调用工具时，参数中带上了上一步的 `sessionId`。
9. 跳转子会话，确认该子会话保留了上一步的历史，并在第二轮对话中继续回答，证明 `sessionId` 复用多轮成功。
