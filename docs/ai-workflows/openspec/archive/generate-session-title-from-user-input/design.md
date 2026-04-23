# Design

## Context

现有 `SessionService.createSessionTitle(sessionId)` 会从会话历史中寻找首条用户消息和首条助手消息。由于调用点位于首轮 `agent_end`，标题必须等待 AI 第一轮完整结束后才会生成。

当前关键代码路径在 [session.service.ts](/Users/liujinglun/code/willow/app/work/src/main/service/session.service.ts)：

- `createSessionTitle(sessionId)` 已经负责读取会话、调用标题 Agent、清洗标题、回退标题、写入数据库并发送 `SESSION_TITLE_UPDATED`。
- `sendMessage(...)` 已经通过 `priorMessageCount === 0` 识别首轮发送。
- `agent.subscribe(...)` 当前只在收到首轮 `agent_end` 后才调用 `void this.createSessionTitle(sessionId)`。

这与聊天工作台的扫描效率不一致：侧边栏、历史页和右侧信息区都依赖会话标题帮助用户快速识别主题。根据 `DESIGN.md`，renderer 的标题应简短直接，服务高频浏览和比较。本次变更将标题生成前移，但不新增 UI 结构。

## Decision

### 1. 标题生成触发点前移到首条用户消息提交后

发送消息流程应在确认会话发送前没有历史消息时，把当前用户输入作为标题生成依据，并异步触发标题生成。

要求：

- 迁移既有 `createSessionTitle` 调用位置，而不是新增一套平行的标题生成流程。
- 不等待默认聊天 Agent 的首轮回复完成。
- 不阻塞主聊天发送、流式输出或工具审批。
- 只针对空会话的首条用户消息触发。
- 后续消息不重复触发自动标题生成。
- 首轮 `agent_end` 不应再作为自动标题生成的必要前置条件。

### 2. 标题生成输入只使用用户首条输入

标题 Agent 的任务从“根据首轮用户提问和助手回复生成标题”调整为“根据首轮用户输入生成标题”。

要求：

- 从 `SendMessage.message` 或等价的首条用户消息内容中提取可读文本。
- 继续使用既有截断和清洗逻辑，避免超长 prompt 或异常输出进入标题字段。
- 不读取、不等待、不拼接助手回复。
- 用户输入为空或不可读时，使用现有回退策略生成稳定标题。

### 3. 用户重命名优先

自动标题写入前必须再次读取会话状态，确认标题仍为空。

要求：

- 如果用户已经手动重命名，自动标题结果不得覆盖。
- 如果其他流程已经生成标题，当前标题任务不得覆盖。
- 标题写入成功后继续发送 `SESSION_TITLE_UPDATED` 事件。

### 4. 错误不影响聊天主链路

标题生成是辅助体验，不应影响消息发送。

要求：

- 标题生成失败时记录错误并静默降级。
- 主聊天 Agent 的发送、流式事件和消息持久化不因标题生成失败而失败。
- 标题模型不可用或返回空内容时，回退为用户输入摘要；摘要也不可用时回退为“新会话”。

## Implementation Notes

- 应优先改造现有 `createSessionTitle(sessionId)`，例如调整为 `createSessionTitle(sessionId, userInput)`，避免新增第二套 title 生成方法。
- `AgentService` 的标题 system prompt 应删除对“助手回复”的依赖，强调只根据“首轮用户输入”生成短标题。
- `sendMessage` 中已有 `priorMessageCount` 判断，可复用它识别首条消息场景。
- 标题任务应使用 `void this.createSessionTitle(...)` 形式异步启动，避免阻塞聊天发送。
- `agent.subscribe(...)` 中当前首轮 `agent_end` 后触发标题生成的分支应移除或改为不再负责标题生成，避免同一首轮消息触发两次。

## Risks

- 仅基于用户输入生成的标题可能少量缺少助手回复带来的语义补充。
- 若用户首条消息包含大量文件引用、技能引用或非自然语言内容，需要依赖现有纯文本抽取和清洗保证标题可读。
- 如果标题生成与用户重命名并发完成，必须以后写入前的空标题检查为准。

## Open Questions

- 当前阶段不新增“临时标题”和“正式标题”的双阶段状态。
- 当前阶段不新增标题生成模型配置，继续复用现有标题 Agent。
