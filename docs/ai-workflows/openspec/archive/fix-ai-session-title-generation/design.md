# Design

## Context

当前标题生成路径位于 [session.service.ts](/Users/liujinglun/code/willow/app/work/src/main/service/session.service.ts)：

- `createSessionTitle(sessionId, userInput)` 使用首轮用户输入构造标题 prompt。
- `agentService.getTitleAgent()` 创建标题 Agent，标题 Agent 复用默认模型配置。
- `lastAssistantPlainText(titleAgent.state.messages)` 读取标题 Agent 最后一条 assistant 输出。

相关模型配置路径位于 [agent.service.ts](/Users/liujinglun/code/willow/app/work/src/main/service/agent.service.ts)：`toAgentModel(config)` 会把 `config.reasoning` 原样写入 Agent 模型。默认模型若启用 reasoning，标题 Agent 也会继承 reasoning。

相关文本提取路径位于 [agent-message-text.ts](/Users/liujinglun/code/willow/app/work/src/main/utils/agent-message-text.ts)：assistant 消息的纯文本提取会包含 `thinking` 块。这对聊天历史展示或兼容旧消息可能有用，但不适合作为标题生成结果读取策略。

## Decision

### 1. 标题 Agent 禁用 reasoning

标题 Agent 是短文本生成辅助任务，应在创建模型配置时强制 `reasoning: false`。

要求：

- 仅影响 `getTitleAgent()` 创建的标题 Agent。
- 不修改默认模型配置本身。
- 不影响主聊天 Agent、自动化 Agent 或其他会话 Agent 的 reasoning 设置。
- 保留标题 Agent 使用默认模型的 provider、api、modelId、baseUrl、contextWindow、maxTokens、apiKey 等既有行为。

### 2. 标题结果只读取普通文本

标题生成结果应使用专用的 assistant 文本提取路径，只读取 `type === "text"` 的内容。

要求：

- 不把 `type === "thinking"`、`thinkingSignature === "reasoning_content"` 或其他 reasoning 字段写入标题。
- 如果 assistant 文本块为空，视为标题生成结果为空。
- 继续使用 `sanitizeSessionTitle(...)` 清洗最终标题。
- 继续使用既有回退：用户输入摘要优先，其次 `新会话`。

### 3. 保持主链路独立

标题修复不得改变聊天发送主链路。

要求：

- 标题生成仍是非阻塞辅助任务。
- 标题 Agent 出错、模型不支持关闭 reasoning、或返回不可用内容时，不得使 `sendMessage(...)` 失败。
- 手动标题仍优先于自动标题，写入前继续检查会话标题是否为空。

## Implementation Notes

- 可以在 `toAgentModel(...)` 增加可选 override，或在 `getTitleAgent()` 中对 `resolvedModel` 做局部覆盖，将 `reasoning` 设为 `false`。
- 建议新增类似 `lastAssistantTextOnly(...)` 的工具函数，供标题结果读取使用；避免改变现有 `lastAssistantPlainText(...)` 的全局语义，降低对消息展示、历史兼容或其他调用方的影响。
- `SessionService.createSessionTitle(...)` 应改用 text-only 提取函数读取标题 Agent 输出。
- 当前 `console.log("titleAgent.state.messages", ...)` 属于调试输出，实施时可一并移除，避免日志记录 reasoning 内容。

## Risks

- 某些模型或 provider 可能忽略 `reasoning: false`。因此 text-only 提取仍是必要兜底。
- 如果标题模型只在 thinking 中给出内容且没有普通文本，标题会回退为用户输入摘要；这是可接受行为，因为内部思考不应暴露为标题。

