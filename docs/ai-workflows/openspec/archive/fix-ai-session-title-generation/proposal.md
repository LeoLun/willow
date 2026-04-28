# Fix AI Session Title Generation

## Summary

修复自动会话标题生成在默认模型开启思考模式时，把 reasoning / thinking 内容当作标题写入的问题。

## Motivation

`SessionService.createSessionTitle(...)` 会调用标题 Agent，并从标题 Agent 的最后一条 assistant 消息中提取文本作为会话标题。当前标题 Agent 复用默认模型配置；如果默认模型开启思考模式，模型可能返回 `thinking` 内容。现有纯文本提取逻辑会把 assistant 的 `thinking` 块也纳入结果，导致会话标题变成推理过程，而不是用户可读的短标题。

会话标题是侧边栏和历史页的高频扫描信息，必须短、稳定、直接。标题生成作为辅助链路，也不应暴露模型内部思考内容。

## Scope

- 更新标题生成能力约束：标题 Agent 必须关闭 reasoning / thinking 模式。
- 更新标题结果提取约束：自动标题只允许使用 assistant 的普通文本输出，不得使用 thinking 内容。
- 保留既有首轮用户输入生成标题、手动重命名优先、失败降级和事件通知行为。
- 不新增 UI、不新增模型配置项、不改变主聊天 Agent 的思考模式配置。

## Success Criteria

- 默认模型开启 reasoning 时，自动标题生成请求仍以非 reasoning 模式执行。
- 如果标题 Agent 响应里同时包含 thinking 和 text，系统只使用 text 生成标题。
- 如果标题 Agent 只返回 thinking 或返回空标题，系统走既有用户输入摘要 / `新会话` 回退。
- 标题生成失败或无法关闭 reasoning 不影响主聊天发送和流式响应。

