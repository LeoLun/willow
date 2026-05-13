# Fix AI Session Title Generation Implementation Plan

## Source Artifacts

- `docs/ai-workflows/openspec/changes/fix-ai-session-title-generation/proposal.md`
- `docs/ai-workflows/openspec/changes/fix-ai-session-title-generation/design.md`
- `docs/ai-workflows/openspec/changes/fix-ai-session-title-generation/tasks.md`
- `docs/ai-workflows/openspec/changes/fix-ai-session-title-generation/specs/session-title/spec.md`

## Goal

修复自动会话标题生成在默认模型开启 reasoning / thinking 时误用思考内容作为标题的问题，同时保持主聊天 Agent 的 reasoning 设置、标题回退逻辑、手动重命名优先和非阻塞发送链路不变。

## Assumptions

- 当前变更只覆盖主进程标题生成链路，不新增 UI 和模型配置项。
- `app/work/src/main/service/agent.service.ts` 和 `app/work/src/main/service/session.service.ts` 当前已有未提交修改；实施前必须先确认这些修改是否属于本变更，避免覆盖用户改动。
- 若项目已有测试框架或临近测试文件可复用，优先补充 focused 单元测试；如果没有合适测试入口，则至少通过 lint 和人工代码路径核查覆盖规格场景。

## Execution Slices

### 1. 保护现有工作区状态

1. 查看 `git status --short`，确认已修改文件列表。
2. 查看 `git diff -- app/work/src/main/service/agent.service.ts app/work/src/main/service/session.service.ts app/work/src/main/utils/agent-message-text.ts`。
3. 判定现有改动是否已经包含本变更的一部分：
   - 如果包含，后续只在现有改动基础上补齐缺口。
   - 如果不包含，编辑时保留现有改动，不回退、不覆盖无关内容。

停止条件：若已有改动与 OpenSpec 要求冲突且无法无损合并，停止实施并回到 `workflow-spec` 或向用户确认。

### 2. 让标题 Agent 强制关闭 reasoning

目标文件：`app/work/src/main/service/agent.service.ts`

1. 在 `getTitleAgent()` 创建 `resolvedModel` 后，将标题 Agent 使用的模型对象局部覆盖为 `reasoning: false`。
2. 保留默认模型的 `id`、`name`、`api`、`provider`、`baseUrl`、`input`、`cost`、`contextWindow`、`maxTokens` 等现有字段。
3. 不修改 `toAgentModel(...)` 的默认行为，除非为了类型安全需要增加明确的局部 override 入口。
4. 不修改 `getDefaultAgent(...)`，确保主聊天 Agent 继续使用配置里的 reasoning 值。

验证点：

- 默认模型 `reasoning: true` 时，`getTitleAgent()` 传给 `agent.setModel(...)` 的对象应为 `reasoning: false`。
- `getDefaultAgent(...)` 仍使用 `toAgentModel(dbModel)` 的原始 reasoning。

### 3. 增加标题专用 text-only 输出提取

目标文件：`app/work/src/main/utils/agent-message-text.ts`

1. 新增标题专用函数，例如 `lastAssistantTextOnly(messages: AgentMessage[]): string`。
2. 该函数只扫描最后一条 assistant 消息中的普通文本块：
   - `content` 为数组时，只拼接 `part.type === "text"` 且 `part.text` 为字符串的内容。
   - 忽略 `thinking`、`thinkingSignature`、reasoning 相关字段和其他非文本块。
   - 如果 assistant 内容不是数组或没有普通 text，返回空字符串。
3. 保留 `extractPlainTextFromAgentMessage(...)` 和 `lastAssistantPlainText(...)` 现有语义，避免影响聊天展示、历史兼容或其他调用方。

验证点：

- thinking + text 输入返回 text。
- only thinking 输入返回空字符串。
- 无 assistant 或 assistant 无 text 返回空字符串。

### 4. 接入 `SessionService.createSessionTitle(...)`

目标文件：`app/work/src/main/service/session.service.ts`

1. 将标题结果读取从 `lastAssistantPlainText(...)` 改为新的 text-only 函数。
2. 保留 `sanitizeSessionTitle(...)`、用户输入摘要回退、`新会话` 回退。
3. 保留写入前再次读取会话并检查标题为空的逻辑。
4. 移除 `console.log("titleAgent.state.messages", ...)` 调试日志，避免完整消息状态进入日志。
5. 确认标题生成异常仍只记录错误，不向 `sendMessage(...)` 抛出。

验证点：

- 标题 Agent only thinking 时，`title` 为空并进入用户输入摘要回退。
- 手动标题已经存在时仍提前返回或写入前放弃。
- `SESSION_TITLE_UPDATED` 只在自动写入成功后发送。

### 5. Focused Verification

优先顺序：

1. 如果已有合适测试环境，新增或更新临近测试覆盖：
   - `lastAssistantTextOnly(...)` 的 text-only 提取场景。
   - `getTitleAgent()` 对 `reasoning` 的局部覆盖，可通过 mock/stub Agent 或提取纯函数测试。
2. 运行 `pnpm lint`。
3. 如果 TypeScript 类型或主进程构建面受影响，运行 `pnpm build`。
4. 人工核对规格场景：
   - 默认模型开启 reasoning 时，标题 Agent 禁用 reasoning。
   - 主聊天 Agent reasoning 不变。
   - thinking + text 只取 text。
   - only thinking 回退。
   - 标题生成失败不影响消息发送链路。

## Files Expected To Change

- `app/work/src/main/service/agent.service.ts`
- `app/work/src/main/service/session.service.ts`
- `app/work/src/main/utils/agent-message-text.ts`
- 可选：临近 `*.test.ts`，仅在项目现有测试入口适配时添加。

## Non-Goals

- 不新增 renderer UI。
- 不新增或迁移数据库字段。
- 不改变默认模型配置保存逻辑。
- 不改变主聊天、自动化或其他 Agent 的 reasoning 策略。
- 不改变自动标题触发时机。

## Handoff

下一步使用 `workflow-implement`，按本计划从工作区状态保护开始实施。

