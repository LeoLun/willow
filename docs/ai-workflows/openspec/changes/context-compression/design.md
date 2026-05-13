# context-compression 设计

## 背景

`app/work/src/main/service/agent.service.ts` 当前在 `getDefaultAgent()` 中读取 `session_messages`，解析为 `AgentMessage[]` 后直接 `agent.replaceMessages(history)`。长会话会把所有历史重新带入模型，直到超过模型 `contextWindow`。`packages/core/src/context/README.md` 已预留“上下文压缩 / 摘要与索引 / 最近会话记录”的方向，但还没有落到实现。

本变更的目标是：当当前会话上下文不足时，在发送前自动压缩早期历史，让 Agent 继续保持最近上下文和早期关键事实，同时不破坏用户可见聊天历史。

## 方案选择

采用提案中的 Approach B：LLM 摘要 + 渐进式索引。

关键取舍：

- 使用当前会话选定模型配置创建隔离的辅助摘要 Agent，而不是复用主对话 Agent 实例，避免摘要请求污染主 Agent 的消息状态和工具流。
- 保留 `session_messages` 作为用户可见聊天历史的事实来源，不用压缩结果覆盖原始消息。
- 新增持久化的上下文压缩状态，用于记录“已经压缩到哪条消息”“摘要正文”“关键索引”“估算 token”等数据；下次构建 Agent 时可直接复用摘要，只对新增且需要压缩的历史做增量摘要。
- 将摘要注入 `CoreAgent` 的系统上下文（例如 `projectContext` 或等价扩展字段），而不是作为普通 user/assistant 消息注入，避免 UI 把摘要当成聊天消息展示。

## 上下文预算算法

实现应提供一个主进程上下文预算模块，输入：

- 当前模型配置：`contextWindow`、`maxTokens`、`modelId`。
- 系统提示词估算：`CoreAgent` 最终系统 prompt 或其保守估算。
- 已持久化摘要正文与索引。
- 会话历史 `AgentMessage[]`。
- 本轮用户输入文本。

预算规则：

1. 使用统一 token 估算函数计算文本和消息近似 token。初版可采用保守字符估算（中文约 1 字 1 token，英文约 4 字 1 token，并对 JSON 消息结构加固定开销），后续可替换为模型 tokenizer。
2. `usableContext = contextWindow - reservedOutputTokens`，其中 `reservedOutputTokens` 优先取 `maxTokens`，但不得低于一个固定最小输出余量。
3. `triggerThreshold = usableContext * 0.8`。
4. `targetBudget = usableContext * 0.6`。
5. 如果 `system + summary + fullHistory + currentInput` 超过 `triggerThreshold`，或超过 `usableContext`，判定当前会话上下文不足，触发压缩。
6. 压缩后重新估算。如果仍超出 `triggerThreshold`，逐步缩小最近完整消息窗口，但必须尽量保留至少最近 3 轮用户/助手交互；若最近窗口本身过大，则保留最近完整消息优先，并记录降级原因。

## 消息切分

历史按用户消息边界切分为会话轮次：

- 一轮从一条 user 消息开始，包含其后的 assistant/tool 相关消息，直到下一条 user 消息前结束。
- 优先保留最近 3-5 轮完整消息。
- 待压缩范围为：上一次压缩游标之后、最近完整窗口之前的消息。
- 如果已有摘要，增量压缩提示词必须带上旧摘要与待压缩新增消息，要求模型输出合并后的新摘要，而不是简单追加。

## 摘要格式

摘要结果必须是稳定、可注入系统上下文的 Markdown 文本，包含：

- `## 已压缩的历史摘要`：按时间顺序概括用户目标、约束、关键问题。
- `## 关键决策与事实`：列出仍会影响后续工作的决策、路径、配置、命令结论。
- `## 已完成操作`：列出 Agent 已完成的修改、验证或调研结果。
- `## 待跟进事项`：列出未完成、被阻塞或用户要求稍后处理的事项。
- `## 索引`：用短行记录重要文件路径、模块名、任务名或用户偏好，便于后续模型快速定位。

摘要提示词必须要求模型：

- 不编造未在历史中出现的事实。
- 保留具体文件路径、命令结果、错误信息、用户明确偏好和开放问题。
- 丢弃寒暄、重复确认、已过期的中间状态。
- 输出中文，除非原始专有名词、代码标识或路径需要保留原文。

## 持久化模型

实现可新增 `session_context_summaries` 或等价表，建议字段：

- `id`
- `session_id`
- `model_id`
- `summary`
- `index_text`
- `compressed_until_message_id`
- `source_message_count`
- `estimated_tokens`
- `created_at`
- `updated_at`

约束：

- 一条会话在同一模型上下文策略下只保留一条当前摘要状态。
- 删除会话时必须删除对应摘要状态。
- 摘要状态不得替代 `session_messages`；聊天历史查询仍返回原始消息。

## Agent 构建流程

`AgentService.getDefaultAgent()` 的目标流程：

1. 解析会话历史。
2. 解析当前模型配置与工作区信息。
3. 估算上下文预算。
4. 若未触发压缩：保持现有 `agent.replaceMessages(history)` 行为。
5. 若触发压缩：创建或更新摘要状态。
6. 构建 `CoreAgent` 时注入历史摘要上下文。
7. 对主 Agent 执行 `replaceMessages(recentHistory)`，只传入最近完整窗口。
8. 发送 renderer 事件，通知本次发送发生了上下文自动压缩。

## 失败与降级

- 摘要 Agent 失败或超时时，不应导致发送流程直接失败。
- 如果压缩失败但完整历史仍低于 `usableContext`，系统可继续使用完整历史并记录告警。
- 如果压缩失败且完整历史会超过 `usableContext`，系统必须执行保守降级：保留最近窗口，注入一段明确说明“更早历史因上下文不足未能成功摘要”的系统上下文，并向 UI 发出降级提示。
- 辅助摘要 Agent 不应启用工具调用，也不应触发 tool approval。
- 摘要过程不得写入普通会话消息，不得触发会话标题生成。

## Renderer 通知

本变更只需要轻量反馈，不做页面重排：

- 主进程通过现有事件桥或新增事件类型通知当前会话发生压缩。
- renderer 在当前会话匹配时展示 `vue-sonner` toast，例如“上下文已自动压缩，较早消息已摘要供 AI 参考”。
- 若压缩降级，则展示错误级别较低的提示，说明较早历史可能不完整。
- 反馈样式必须遵循 `DESIGN.md`：使用现有 `@willow/shadcn` / `vue-sonner`，不新增装饰性 UI。

## 验证

- 单元级验证上下文预算、轮次切分、摘要游标更新、失败降级。
- 主流程验证未触发压缩时 `replaceMessages(history)` 行为不变。
- 主流程验证触发压缩时只把最近窗口放入主 Agent 历史，并把摘要放入系统上下文。
- renderer 验证收到压缩事件后展示 toast，且非当前会话事件不会提示。
- 最终运行 `pnpm lint` 和 `pnpm build`。
