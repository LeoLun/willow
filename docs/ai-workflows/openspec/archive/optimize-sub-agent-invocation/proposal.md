# 优化子 Agent 调用样式与 SessionId 支持提案

## 动机

当前应用支持在对话空间委派任务给特定工作空间的子 Agent，但目前的设计存在以下问题：
1. **UI 体验粗糙**：
   - 委派工具卡片（`WorkspaceDelegateToolRenderer`）设计单一，且子 Agent 运行的结果（Markdown/表格等）被强行放入一个限制了交互的 CollapsibleTrigger（作为 button 嵌套）中，使用 raw pre/pre-wrap 渲染，无法实现 Markdown 精美排版（如表格、列表、样式标签），且无法正常选中文本或独立点击内部按钮（因为点击会触发展开折叠）。
   - 缺乏状态标识（运行中、已完成、已失败、已中止等），用户无法一眼看出委派的状态。
2. **逻辑硬编码且无法回调**：
   - 目前在 `SessionService.sendMessage` 层面对 Conversation 且带有 `targetWorkspaceId` 的会话做了拦截，主 Agent 根本没有运行，而是直接通过 mock 工具调用的形式生成了子 Agent 执行结果。这导致：
     - 主 Agent 无法作为一个“编排者”获取子 Agent 的返回内容并进行后续分析。
     - 子 Agent 委派不能被主 Agent 作为一个常规 Tool（`workspace_delegate`）在多步规划中自主调用。
3. **不支持 sessionId**：
   - 每次委派都会创建一个全新的子会话，无法在同一个子会话中进行多轮对话，难以进行渐进式分析。

## 目标

1. **子 Agent 委派 Tool 化**：
   - 移除 `SessionService` 顶层的硬编码拦截，将其重构为真正的 `workspace_delegate` 工具，作为主 Agent 的 `extraTools` 提供。
   - `workspace_delegate` 接收参数：`workspaceId`（目标工作空间）、`task`（指派任务）、`sessionId`（可选的复用子会话 ID）。
   - 当用户在 UI 顶层指定特定工作空间 Agent（如 @-mention）时，通过系统提示词强引导或强制主 Agent 调用 `workspace_delegate` 工具，确保执行路径的确定性。
   - 工具执行结果（子 Agent 的最终回答）作为工具的返回值（Content text）返回给主 Agent，主 Agent 基于此结果回复用户，实现“回调主 Agent”。

2. **支持 sessionId 实现多轮对话**：
   - `workspace_delegate` 工具支持传入 `sessionId` 参数。
   - 工具执行时，若传入 `sessionId` 且该会话存在且属于对应工作空间，则复用该子会话；否则创建新会话。
   - 工具返回的 details/text 中包含 `childSessionId`，使得主 Agent 能够学习并记住子会话 ID，并在后续追加对话时通过 `sessionId` 参数调用，维持上下文。

3. **重构子 Agent 委派卡片 UI**：
   - 重构 `WorkspaceDelegateToolRenderer.vue`，严格遵循项目 `DESIGN.md` 规范。
   - 彻底修复嵌套按钮（button in button）的 HTML 违法结构。折叠触发器仅保留标题和简短状态；所有的执行详情、生成的 Markdown 结果以及操作按钮全部移入 `#details` 插槽中（位于 `CollapsibleContent` 内）。
   - 使用 `@willow/ui` 导出的 `MarkdownBlock` 渲染子 Agent 的返回内容，支持完美排版（表格、代码高亮等）。
   - 丰富状态展示：对「运行中」、「已完成」、「已失败/中止」进行色彩与图标的语义化区分。
   - 支持在运行中直接获取并显示 `childSessionId`，使用户能够在子 Agent 运行时一键跳转追踪。

## 范围

- `app/work/src/main/service/tools/workspace-delegate.tool.ts` (新增): 定义 `workspace_delegate` 工具。
- `app/work/src/main/service/session.service.ts` (修改): 移除顶层拦截逻辑，实现 `workspace_delegate` 工具在后台的具体运行逻辑（包括子会话复用、状态更新、审批流转发）。
- `app/work/src/main/service/agent.service.ts` (修改): 注册 `workspace_delegate` 工具，注入系统提示词以及可选的工作空间强制委派指令。
- `packages/ui/src/renderers/WorkspaceDelegateToolRenderer.vue` (修改): 重新设计并重构 UI 卡片样式，接入 `MarkdownBlock` 渲染，重构插槽结构。

## 非范围

- 不改变现有工作空间子 Agent 的执行引擎和内部逻辑。
- 不影响单工作空间会话的正常使用。
- 不添加额外的用户账户或权限校验机制。
