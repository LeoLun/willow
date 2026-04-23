# Generate Session Title From User Input Implementation Plan

## Scope

对应 OpenSpec change：

- `docs/ai-workflows/openspec/changes/generate-session-title-from-user-input/proposal.md`
- `docs/ai-workflows/openspec/changes/generate-session-title-from-user-input/design.md`
- `docs/ai-workflows/openspec/changes/generate-session-title-from-user-input/tasks.md`
- `docs/ai-workflows/openspec/changes/generate-session-title-from-user-input/specs/session-title/spec.md`

目标是迁移现有会话标题生成流程：继续复用 `SessionService.createSessionTitle`、标题 Agent、标题清洗、数据库写入和 `SESSION_TITLE_UPDATED` 事件，但把触发时机从首轮 `agent_end` 后前移到空会话首条用户输入提交后，并让标题生成只基于用户输入。

## Assumptions

- 不新增 UI，也不改变渲染侧监听 `SESSION_TITLE_UPDATED` 的机制。
- 不新增标题生成模型配置，继续复用 `AgentService.getTitleAgent()`。
- 首条用户输入来自 `SendMessage.message`，当前 `buildPromptInput(...)` 会 trim 后传给主聊天 Agent；标题生成也应使用同一语义的用户可读文本。
- 标题生成失败只记录错误并降级，不影响 `sendMessage(...)` 主流程。

## Implementation Slices

### 1. 调整标题 Agent prompt

涉及文件：

- `app/work/src/main/service/agent.service.ts`

步骤：

- 将 `titleSystemPrompt` 从“根据首轮用户提问和助手回复摘要”改成“仅根据首轮用户输入”。
- 保留输出约束：中文短标题、只输出标题本身、不带解释或换行。
- 不改变 `getTitleAgent()` 的模型选择、API key 解析和 Agent 创建逻辑。

验证：

- 静态检查 prompt 中不再提到助手回复。
- 确认 `getTitleAgent()` 外部调用方式仍兼容后续改造。

### 2. 改造 `createSessionTitle` 的输入来源

涉及文件：

- `app/work/src/main/service/session.service.ts`
- 可能涉及 `app/work/src/main/utils/agent-message-text.ts`

步骤：

- 将 `createSessionTitle(sessionId)` 改为接收首条用户输入文本，例如 `createSessionTitle(sessionId, userInput)`。
- 在方法入口继续读取 session，并保留“session 不存在或 title 已非空则直接返回”的保护。
- 删除对会话历史中首条 assistant message 的依赖；标题生成不再要求 `assistantMsg` 存在。
- 对传入的 `userInput` 执行 `clipForTitlePrompt(...)`，为空时仍进入回退逻辑。
- 调用标题 Agent 时，prompt 只包含用户首条输入；不拼接助手回复。
- 保留 `sanitizeSessionTitle(lastAssistantPlainText(titleAgent.state.messages))` 读取标题 Agent 输出的逻辑。
- 保留空结果回退：优先 `sanitizeSessionTitle(userText.slice(0, 40))`，再回退为 `新会话`。
- 写入前继续二次读取 session，确认 title 仍为空，避免覆盖用户重命名。
- 写入成功后继续发送 `SESSION_TITLE_UPDATED`。
- 如 `isUserLikeMessage`、`extractPlainTextFromAgentMessage` 变为未使用导入，移除对应 import；除非仍被同文件其他逻辑使用。

验证：

- TypeScript 无未使用导入。
- `createSessionTitle` 内没有 assistant message 必要条件。
- 方法失败 catch 仍吞掉错误并打印日志，不向 `sendMessage` 抛出。

### 3. 前移 `sendMessage` 中的标题触发点

涉及文件：

- `app/work/src/main/service/session.service.ts`

步骤：

- 保留现有 `priorMessageCount = this.sessionMessageDao.findBySessionId(sessionId).length`。
- 在构建主聊天 prompt 的同一输入语义上得到 `promptInput`，避免 `buildPromptInput(...)` 被调用两次产生不一致日志或副作用。
- 当 `priorMessageCount === 0` 时，在 `agent.prompt(promptInput)` 前异步调用 `void this.createSessionTitle(sessionId, promptInput)`。
- 该调用不得 `await`，确保不阻塞主聊天 Agent。
- 保留 `agent.prompt(promptInput)` 作为主流程入口。

验证：

- 标题生成在主聊天 Agent 完成前已经被启动。
- `sendMessage` 的返回、异常处理和 `finally` 清理逻辑不因标题生成改变。

### 4. 移除首轮 `agent_end` 标题触发

涉及文件：

- `app/work/src/main/service/session.service.ts`

步骤：

- 在 `agent.subscribe(...)` 的 `event.type === "agent_end"` 分支中保留 `persistAgentMessagesSnapshot(...)`。
- 移除 `if (priorMessageCount === 0) { void this.createSessionTitle(sessionId); }` 或确保该分支不再负责标题生成。
- 保留 `agent_end` 时把 `event.messages` 替换成 `agent.state.messages` 的 outgoing 逻辑。

验证：

- 首轮 `agent_end` 到达时不会再次触发标题生成。
- 消息持久化仍在 `agent_end` 时执行。

### 5. 并发和回退验证

涉及文件：

- `app/work/src/main/service/session.service.ts`

步骤：

- 检查 `createSessionTitle` 写入前的二次读取仍存在，并以空 title 为写入条件。
- 检查标题生成失败 catch 不影响聊天发送。
- 确认后续消息不触发标题生成：依赖 `priorMessageCount === 0`。

手动验证建议：

- 新建空会话，发送首条会导致长回复的问题，观察标题在首轮回复结束前生成或至少已开始请求。
- 在标题生成未完成时手动重命名，确认自动标题不会覆盖手动标题。
- 发送第二条消息，确认不会再次触发自动标题。
- 临时让标题 Agent 返回空或失败，确认聊天回复流程仍继续，并按回退逻辑得到标题或保持主流程不失败。

### 6. 检查命令

优先运行：

- `pnpm lint`

如本次 TypeScript 变更引发类型风险，继续运行：

- `pnpm build`

如果完整 build 成本过高或被环境阻塞，需要在最终实现说明里明确未运行原因和替代检查结果。

## Stop Conditions

- 如果发现 `SendMessage.message` 并不能代表用户提交的完整首条输入，需要回到 `workflow-spec` 补充“标题输入源”的产品定义。
- 如果标题生成必须依赖已持久化消息而不能接受原始输入，需要回到 `workflow-spec` 重新确认是否改为先持久化用户消息。
- 如果实现需要新增 UI、数据库字段或标题状态枚举，超出当前 OpenSpec，应停止并回到 `workflow-spec`。

## Handoff To workflow-implement

执行时严格按以上切片修改，优先保持变更集中在：

- `app/work/src/main/service/session.service.ts`
- `app/work/src/main/service/agent.service.ts`

完成后更新 OpenSpec `tasks.md` 的勾选状态，并运行相关检查。
