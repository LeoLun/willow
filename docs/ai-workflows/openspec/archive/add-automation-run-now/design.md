# Design: add-automation-run-now

## Scope

本设计覆盖自动化详情页的手动立即执行入口，以及 renderer / preload / IPC / 主进程服务层为该入口新增的最小通道。

相关既有约束：

- 自动化基础能力来自归档 change `add-automation-feature`。
- 详情页 Prompt 编辑能力来自归档 change `add-automation-prompt-markdown-editor`。
- renderer 和 shadcn-vue 页面设计遵守仓库根 `DESIGN.md`。

## User Interaction

自动化详情页右上角操作区新增“立即执行”按钮，位置建议放在保存/重置操作之前或紧邻保存操作，视觉层级低于“保存”：

- 使用 `Button variant="outline" size="sm"` 或同等次级按钮。
- 按钮包含 lucide 图标，例如 `Play`。
- 启动请求进行中展示“执行中...”或“启动中...”并禁用按钮。
- 启动成功后立即跳转到本次执行创建的会话页，不在详情页等待整轮 AI 完成。
- 当自动化未加载、当前表单存在未保存修改、表单无效，或已有手动触发请求正在进行时禁用按钮。

禁用未保存修改时应避免误导用户：立即执行使用“已保存配置”，不是当前未保存表单内容。详情页已有保存和脏状态语义，因此本次不自动保存后执行。

## API Shape

在共享 API 中新增：

- `RunAutomationNowRequest`
  - `id: number`
- `RunAutomationNowResponse`
  - `automation: Automation`
  - `session: Session`

在共享 hook 中新增：

- `runAutomationNow(request: RunAutomationNowRequest): Promise<RunAutomationNowResponse>`

在 IPC constants 中新增：

- `RUN_AUTOMATION_NOW`

在 preload 的 `electronAPI` 上新增同名方法，沿用现有自动化 API 的错误处理模式。

## Main Process Flow

新增 `RunAutomationNowController`：

1. 校验 `request.id`。
2. 调用 `AutomationService.runAutomationNow(id)`。
3. 返回刷新后的 `Automation` 详情和本次执行创建的 `Session`。

`AutomationService.runAutomationNow(id)` 应：

1. 校验自动化存在。
2. 校验自动化当前可执行。默认要求自动化为 `enabled` 且 trigger active，保持与 `runAutomationById` 一致。
3. 使用当前时间作为手动触发的 `scheduledFor` 与 `triggeredAt`。
4. 创建本次执行专用 session。
5. 创建 `automation_runs` running 记录并写入 `session_id`。
6. 启动 AI 发送流程，但不等待整轮 AI 完成后才返回 IPC。
7. 立即返回最新的 `Automation` 详情和新建 session。
8. 后台执行完成或失败后继续更新 `automation_runs`、`lastCompletedAt` 和错误信息。

如果实现阶段决定保留 `AutomationRunKind = "scheduled" | "catch_up"` 不扩表迁移，手动执行可以临时使用 `scheduled`，但必须在代码注释或 design follow-up 中说明这是兼容策略。推荐新增 `manual` run kind，并在 schema、类型、展示函数中补齐对应中文标签“手动执行”。

## Run Semantics

手动立即执行的语义：

- 立即执行不会注册、注销或重置 cron task。
- 立即执行不会改变自动化 `status`。
- 立即执行使用数据库中已保存的 prompt、workspace、model 和 trigger 状态。
- 手动执行与定时执行共享同一条自动化的并发保护；同一自动化已有运行中任务时，不应启动第二次。
- 若已有运行导致本次无法启动，controller 应返回可理解的错误，renderer 展示失败 toast。
- 成功启动后应返回本次运行关联的 session，并在最新运行摘要中体现 running/manual 状态；如果新增 `manual` run kind，摘要应能展示“手动执行”。
- 手动执行的 IPC 返回时机是“会话已创建且执行已启动”，不是“AI 已完成回复”。
- 后台执行完成后应继续把 run 状态更新为 `completed` 或 `failed`。

关于 `lastScheduledAt`：

- 推荐不要让手动执行推进 `lastScheduledAt` 的 cron 补偿锚点，以免影响漏跑补偿判断。
- 若复用现有 `runAutomationById` 会写入 `lastScheduledAt`，实现阶段应提取内部执行方法，使 scheduled/catch_up 继续维护 `lastScheduledAt`，manual 只维护 `lastRunAt` / `lastCompletedAt` 和 `automation_runs`。

## Renderer State

Pinia `useAutomationStore` 新增 `runAutomationNow(id)` action：

- 调用 `electronAPI.runAutomationNow({ id })`。
- 用响应中的 `automation` 更新 `automationDetails`。
- 同步替换 `automationList` 中对应条目。
- 返回更新后的 `automation` 与 `session`。

`AutomationDetail.vue` 新增局部状态：

- `isRunningNow`

按钮点击处理：

1. 如果自动化未加载、存在未保存修改、表单无效或正在请求，则直接返回。
2. 调用 store action。
3. 成功后用返回的 automation 更新 store / 本地表单基线。
4. 调用 `useSessionStore().fetchSessionList([session.workspaceId])` 刷新左侧会话列表。
5. `router.push(\`/${session.id}\`)` 跳转到本次执行会话。
6. 展示 `toast.success("已开始执行")`。
7. 失败时展示错误 toast，并留在自动化详情页。

主进程方法不得等待 AI 发送完整完成才返回；否则详情页会一直停留在“执行中...”状态。手动执行应采用“创建 session + 写入 running run + 启动后台发送 + 立即返回”的策略。聊天页已有 active stream 恢复与消息事件机制，跳转后应能观察本次执行继续推进。

## Design Standard Notes

依据 `DESIGN.md`：

- 详情页头部已有稳定右上角操作区，本次只新增一个次级操作，不制造新的页面区块。
- “立即执行”是工具型动作，使用 lucide 图标加短文本按钮；如后续改为纯图标按钮，必须配 Tooltip。
- 保存仍是当前编辑流程主操作；立即执行不得使用与保存竞争的主按钮样式。
- 按钮 disabled/loading 状态必须明确，避免重复触发和状态跳动。

## Open Questions

- 手动执行是否允许 disabled 自动化运行？本规格默认不允许，以保持与调度执行一致。若产品希望“停用仅停止定时，但仍允许手动运行”，应先回到 `workflow-spec` 修订该需求。
- 手动执行是否应该自动保存未保存编辑？本规格默认不自动保存，以避免用户误触后执行尚未确认的配置。
- 如果后台执行启动后失败，是否需要在自动化详情页主动弹出失败提示？本规格不要求跨页面失败 toast；失败应至少记录到运行记录，并由会话页/消息流体现执行错误。
