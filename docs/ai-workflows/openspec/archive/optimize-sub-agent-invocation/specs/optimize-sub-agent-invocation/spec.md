# 子 Agent 委派工具化与 UI 优化功能规格说明书

## 1. 功能需求

### 1.1 `workspace_delegate` 工具规格
- **工具名称**：`workspace_delegate`
- **Schema 定义**：
  - `workspaceId` (number): 目标工作空间的 ID，必须存在。
  - `task` (string): 指派的任务提问。
  - `sessionId` (number, optional): 子会话 ID。如果传入，后台会尝试查找该会话。若该会话存在且与 `workspaceId` 匹配，则继续在该会话中对话（即实现多轮上下文）；若不匹配或不存在，则自动降级新建一个会话并把新会话 ID 返回给主 Agent。
- **返回值结构**：
  - `content` (Array): 返回一个包含 text 的数组，其中包含子 Agent 的流式输出结果（Markdown 格式），以及包含新生成或复用的子会话 ID 的说明。
  - `details` (Object): 结构化细节，以供前端渲染使用：
    - `childSessionId` (number): 实际使用的子会话 ID。
    - `workspaceId` (number)
    - `workspaceName` (string)
    - `agentName` (string)
    - `status` (string): 执行状态，例如 `"completed"`, `"failed"`, `"stopped"`.
    - `summary` (string): 子 Agent 执行的最后结果。

### 1.2 动态会话 ID 回传 (childSessionId)
- 子会话是在工具一开始执行时创建或确定的。
- 为了避免用户在漫长的工具执行过程中干等，主进程必须在确定 `childSessionId` 后，**即刻**将其更新到当前主会话活跃 Stream 的 `workspace_delegate` 对应 `toolCall.arguments` 中，并推送事件更新。
- 前端接收到该更新后，即便工具本身还在 `running` 状态，也应该能看到“查看子会话”按钮，点击可跳转以追踪子会话的流式运行和工具审批。

### 1.3 子会话审批流转发
- 子 Agent 运行时若调用了需要审批的敏感工具，对应的审批请求（ToolApproval）将通过 `forwardApprovalsToParentSessionId` 转发到父会话中展示和决策。

---

## 2. 界面设计规格 (Renderer)

### 2.1 样式要求 (DESIGN.md 合规)
- **视觉风格**：整体呈现冷静、专业、紧凑的工作台风格，禁止大块花哨渐变与悬浮重阴影，与 shadcn neutral 风格一致。
- **圆角与边框**：圆角继承项目系统的 `--radius`。边框使用细 border (`border-border/50`)，hover 背景使用 `hover:bg-muted/40`。

### 2.2 交互层级优化 (彻底解决 HTML 嵌套问题)
- **卡片头部 (CollapsibleTrigger / Button)**：
  - 图标：使用 `Bot` 机器人图标。
  - 标题：`委派「${workspaceName} / ${agentName}」`。
  - 折叠触发器不可放入可交互控件（如 Button 或 A 标签），只展示纯文本的辅助状态，例如：
    - 运行态：`正在执行委派任务...` (浅色，伴随 shimmer 或转圈)
    - 完成态：`委派执行已完成`
    - 失败态：`委派执行失败` (红色)
- **折叠展开区 (CollapsibleContent / #details 插槽)**：
  - 所有的核心内容和交互控件全部放于此处，防止冒泡冲突。
  - **内衬面板**：`bg-muted/20 border border-border/50 rounded-lg p-3.5 flex flex-col gap-3`。
  - **状态行**：
    - 运行中：Pulsing 动画的点 + `正在执行中，你可以随时点击下方按钮跳转以查看实时步骤。`
    - 完成：绿色 `CheckCircle2` 图标 + `已完成`。
    - 失败：红色 `XCircle` 图标 + `已失败`。
  - **结果展示**：使用项目内置的 `<MarkdownBlock :content="summary" />` 进行排版展示，支持表格和代码块的正常显示与复制。
  - **操作栏**：
    - 一个 Outline 样式的 `Button`，文字为“查看子会话”，伴随 `ArrowRight` 图标。
    - 按钮下方附带辅助提示：“点击跳转到该工作空间的独立会话中查看完整上下文”。
    - 只要 `childSessionId` 存在（不论是正在运行还是运行完毕），该按钮即呈可点击状态。
