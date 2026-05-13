# context-compression 实施计划

## OpenSpec 输入

本计划严格基于以下 OpenSpec 产物，不替代产品事实：

- `docs/ai-workflows/openspec/changes/context-compression/proposal.md`
- `docs/ai-workflows/openspec/changes/context-compression/design.md`
- `docs/ai-workflows/openspec/changes/context-compression/tasks.md`
- `docs/ai-workflows/openspec/changes/context-compression/specs/context-compression/spec.md`

## 实施原则

1. 不修改 `@mariozechner/pi-agent-core` 内部协议。
2. 不用摘要覆盖 `session_messages`，用户可见聊天历史仍以原始消息为准。
3. 摘要只作为系统上下文注入主 Agent，不作为普通 user / assistant 消息写入会话。
4. 辅助摘要 Agent 必须隔离于主聊天 Agent，不启用工具，不触发工具审批。
5. 未触发压缩时，`AgentService.getDefaultAgent()` 的历史注入行为必须与现有逻辑一致。
6. renderer 只做非阻塞 toast 反馈，遵循 `DESIGN.md` 和现有 `vue-sonner` / `@willow/shadcn` 体系，不做页面重排。

## Slice 1: 上下文预算与消息切分

目标：先建立不依赖数据库和 LLM 的纯逻辑模块，支撑后续集成。

涉及文件：

- 新增 `app/work/src/main/utils/context-token-estimator.ts`
- 新增 `app/work/src/main/utils/context-message-window.ts`
- 可选新增邻近测试文件 `*.test.ts`

实现步骤：

1. 定义保守 token 估算函数，覆盖普通文本、JSON 化 AgentMessage、固定消息结构开销。
2. 实现预算计算：`reservedOutputTokens`、`usableContext`、`triggerThreshold`、`targetBudget`。
3. 输入 `contextWindow` 和 `maxTokens` 时，确保不会把完整上下文窗口都用于输入历史。
4. 按 user 消息边界切分会话轮次：一轮从 user 开始，到下一条 user 前结束。
5. 实现最近窗口选择：默认保留最近 5 轮，预算紧张时可缩到 3 轮；若最近窗口本身过大，保留最新消息并返回降级原因。
6. 返回明确结构：`shouldCompress`、`messagesToCompress`、`recentMessages`、`budget`、`degradationReason?`。

验证：

- 构造短历史，确认低于阈值时 `shouldCompress = false`。
- 构造长历史和长本轮输入，确认超过 80% 可用上下文时触发。
- 构造多轮 user / assistant 历史，确认压缩边界不切断一轮对话。
- 构造最近窗口过大场景，确认不会计划提交超过可用上下文的输入。

OpenSpec 映射：

- task 1.1、1.2、1.3、1.4
- Requirement: 自动检测当前会话上下文不足
- Requirement: 压缩早期历史并保留最近完整轮次

## Slice 2: 摘要状态持久化

目标：提供可复用的摘要状态，同时保持原始聊天历史不变。

涉及文件：

- `app/work/src/main/db/schema.ts`
- 新增迁移 `app/work/src/main/db/migrations/0007_*.sql`
- 更新 `app/work/src/main/db/migrations/meta/*`
- 新增 `app/work/src/main/service/dao/session-context-summary.dao.service.ts`
- `app/work/src/main/service/session.service.ts`
- 可能需要更新主进程依赖注入模块 `app/work/src/main/app.module.ts`
- `app/work/src/shared/api.ts` 中新增必要类型

实现步骤：

1. 新增 `session_context_summaries` 表，字段按 OpenSpec design：`session_id`、`model_id`、`summary`、`index_text`、`compressed_until_message_id`、`source_message_count`、`estimated_tokens`、时间戳。
2. 为 `session_id` 增加外键；若迁移工具支持 cascade，可使用 `onDelete: cascade`，否则在服务层删除。
3. 新增 DAO：按会话和模型读取当前摘要、upsert 摘要、删除单会话摘要。
4. 在 `SessionService.deleteSession()` 中删除摘要状态，位置放在删除原始消息附近。
5. 不修改 `getSessionHistory()` 和 `getSessionHistoryAgentMessages()` 的返回语义。

验证：

- 读取会话历史仍只返回原始 `session_messages`。
- 删除会话时摘要状态同步删除。
- 重复 upsert 同一会话摘要时只保留当前状态。

OpenSpec 映射：

- task 2.1、2.2、2.3、2.4
- Requirement: 持久化压缩状态但保留原始聊天历史

## Slice 3: 隔离摘要生成服务

目标：实现不污染主会话、不启用工具的摘要生成能力。

涉及文件：

- `app/work/src/main/service/agent.service.ts`
- 新增 `app/work/src/main/service/context-compression.service.ts`
- 新增 `app/work/src/main/utils/context-summary-prompt.ts`
- `app/work/src/main/utils/agent-message-text.ts`

实现步骤：

1. 在 `AgentService` 或独立 helper 中新增创建摘要 Agent 的方法：复用当前模型配置、API key 和 `streamSimple`，但只设置摘要 system prompt 和模型，不设置 `CoreAgent` 工具。
2. 编写中文摘要提示词，输出固定 Markdown 结构：历史摘要、关键决策与事实、已完成操作、待跟进事项、索引。
3. 将旧摘要和新增待压缩消息一并传入摘要 prompt，要求输出合并后的当前摘要。
4. 增加超时控制。超时或空摘要返回结构化失败结果，不抛出到主发送流程顶层。
5. 从摘要 Agent 的消息中只提取普通 assistant 文本，避免 thinking 内容进入摘要。
6. 摘要成功后更新摘要状态和压缩游标。

验证：

- 摘要 Agent 不调用 `CoreAgent`，不注册工具，不触发 approval coordinator。
- 摘要请求和响应不写入 `session_messages`。
- 摘要失败返回降级信息，主 Agent 状态不含摘要请求。

OpenSpec 映射：

- task 3.1、3.2、3.3、3.4
- Requirement: 摘要生成隔离于主对话流程
- Requirement: 压缩失败时可降级继续

## Slice 4: CoreAgent 系统上下文注入能力

目标：给主 Agent 注入摘要上下文，同时不影响未压缩路径。

涉及文件：

- `packages/core/src/core-agent.ts`
- `packages/core/src/system-prompt.ts`
- `packages/core/src/context/README.md`
- `packages/core/src/index.ts` 如需导出新增类型

实现步骤：

1. 复用现有 `projectContext` 或新增更明确的 `compressedContext` 选项；优先选择最小改动，避免重写系统 prompt 架构。
2. 若使用新增字段，扩展 `CoreAgentOptions` 和 `SystemPromptOptions`，在系统 prompt 中以清晰标题注入“已压缩历史上下文”。
3. 未传入摘要上下文时，生成的 system prompt 与现有结构保持一致。
4. 更新 `packages/core/src/context/README.md`，记录触发时机、摘要与索引、最近会话记录的实现边界。

验证：

- 没有摘要上下文时，普通 CoreAgent 创建仍可构建 system prompt。
- 有摘要上下文时，prompt 中包含摘要块且不作为普通消息。

OpenSpec 映射：

- task 4.3、6.4
- Requirement: 通过系统上下文注入摘要

## Slice 5: AgentService 主流程集成

目标：把预算、摘要、最近窗口和 DeepSeek history 归一化串到真实发送流程。

涉及文件：

- `app/work/src/main/service/agent.service.ts`
- `app/work/src/main/service/session.service.ts`
- `app/work/src/main/service/event.service.ts`
- `app/work/src/shared/constants.ts`
- `app/work/src/shared/api.ts`

实现步骤：

1. 修改 `AgentService.getDefaultAgent()` 签名，传入本轮 `promptInput` 或等价上下文，以便预算包含本轮用户输入。
2. 在 `SessionService.sendMessage()` 调用 `getDefaultAgent()` 时传入 `promptInput`。
3. 在 `getDefaultAgent()` 中按顺序：解析模型、读取 workspace、读取历史、计算预算。
4. 未触发压缩：保持现有 `agent.replaceMessages(history)` 行为。
5. 触发压缩：调用上下文压缩服务，得到摘要上下文和 `recentMessages`。
6. 对 `recentMessages` 应用现有 `normalizeDeepSeekReasoningHistory()`，再传入 `agent.replaceMessages(recentHistory)`。
7. 压缩成功或降级时，通过事件服务发送上下文压缩通知。
8. 确认 `persistAgentMessagesSnapshot()` 在 agent_end 后仍写入主 Agent 的完整状态；如果主 Agent 状态只包含最近窗口和本轮新增消息，必须先暂停并回到 `workflow-spec` 明确“压缩后持久化是否保留早期原始消息”的技术语义，避免误删原始历史。

验证：

- 未触发压缩时，主 Agent 历史和现状一致。
- 触发压缩时，主 Agent 只接收最近窗口，摘要进入系统上下文。
- DeepSeek reasoning 历史归一化仍作用于最近窗口。
- 摘要失败但完整历史可发送时，继续使用完整历史。
- 摘要失败且完整历史不可发送时，走降级窗口并发送降级事件。

OpenSpec 映射：

- task 4.1、4.2、4.3、4.4、4.5
- Requirement: 自动检测当前会话上下文不足
- Requirement: 通过系统上下文注入摘要
- Requirement: 压缩失败时可降级继续

## Slice 6: Renderer 非阻塞反馈

目标：用户能知道上下文已自动压缩，且不改变聊天布局。

涉及文件：

- `app/work/src/shared/constants.ts`
- `app/work/src/shared/api.ts`
- `app/work/src/renderer/src/composables/useAgentMessages.ts`
- 可能涉及 `app/work/src/renderer/src/pages/chat/session/Session.vue`

实现步骤：

1. 新增事件常量，例如 `CONTEXT_COMPRESSION_UPDATED`，并定义 payload：`sessionId`、`status: "compressed" | "degraded"`、`message?`、`estimatedTokens?`。
2. renderer 在会话消息 composable 或聊天页监听该事件。
3. 事件 `sessionId` 与当前会话一致时显示 `vue-sonner` toast。
4. 成功提示使用“上下文已自动压缩，较早消息已摘要供 AI 参考”一类文案。
5. 降级提示使用“较早历史可能不完整，AI 已优先保留最近上下文”一类文案。
6. 非当前会话事件直接忽略。

验证：

- 当前会话压缩事件显示 toast。
- 非当前会话事件不显示 toast。
- toast 不修改 `state.messages`、`streamMessage` 或布局状态。

OpenSpec 映射：

- task 5.1、5.2、5.3、5.4
- Requirement: 通知用户上下文已自动压缩

## Slice 7: 最终验证与任务收尾

目标：验证实现与 OpenSpec 完整对齐，并只勾选真实完成的任务。

步骤：

1. 补充或运行纯逻辑测试，覆盖预算、切分、降级。
2. 用一段长会话手动验证：低于阈值不压缩，高于阈值触发压缩。
3. 验证聊天历史接口仍返回原始消息。
4. 验证删除会话后摘要状态清理。
5. 验证摘要失败路径不会让主发送流程直接崩溃。
6. 运行 `pnpm lint`。
7. 运行 `pnpm build`。
8. 更新 `docs/ai-workflows/openspec/changes/context-compression/tasks.md`，只勾选已实现且已验证的条目。

OpenSpec 映射：

- task 6.1、6.2、6.3、6.4

## 依赖与假设

- 当前没有仓库级测试脚本；如实现中新增测试，应优先放在源文件附近，并用项目已有工具可运行的方式验证。
- 数据库迁移应沿用当前 Drizzle 迁移目录和 schema 风格。
- `openspec/` 根路径在当前工作区不存在，应使用真实路径 `docs/ai-workflows/openspec/` 或在 `docs/ai-workflows` 下运行 OpenSpec CLI。
- 摘要 token 估算初版允许保守近似；如果后续要求精确 tokenizer，需要回到 `workflow-spec` 明确模型 tokenizer 依赖和失败策略。

## 停机条件

遇到以下情况，停止实现并回到 `workflow-spec`：

- 压缩后 `agent.state.messages` 的持久化会导致早期原始 `session_messages` 被删除，且无法在当前实现边界内保留用户可见历史。
- `CoreAgent` 无法在不影响现有 system prompt 的前提下注入摘要上下文。
- 摘要 Agent 必须启用工具才能满足需求。
- renderer 反馈需要新增持久 UI、上下文仪表盘或手动压缩按钮。
- 数据库迁移需要改变现有 `session_messages` 语义或历史查询响应契约。

## 交接到 workflow-implement

进入 `workflow-implement` 后，按 Slice 1 到 Slice 7 顺序推进。每完成一个 slice，运行该 slice 对应的最小验证；发现 OpenSpec 没有定义的行为时，不在代码中临时扩展，先回到 `workflow-spec` 补齐。
