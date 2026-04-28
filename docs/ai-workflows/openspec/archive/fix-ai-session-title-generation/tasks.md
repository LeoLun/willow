# Tasks

## 1. Implementation

- [x] 在标题 Agent 创建路径中强制关闭 reasoning / thinking 模式，并确保不修改默认模型配置。
- [x] 新增或调整标题结果提取逻辑，使自动标题只读取 assistant 普通 text 内容。
- [x] 更新 `SessionService.createSessionTitle(...)` 使用 text-only 标题结果，并保留现有清洗、回退、手动重命名优先和事件通知行为。
- [x] 移除标题生成调试日志，避免记录标题 Agent 的完整消息状态。

## 2. Verification

- [x] 验证默认模型开启 reasoning 时，标题 Agent 仍以 `reasoning: false` 创建。
- [x] 验证标题 Agent 返回 thinking + text 时，最终标题来自 text。
- [x] 验证标题 Agent 只返回 thinking 或空文本时，最终标题回退到用户输入摘要或 `新会话`。
- [x] 运行相关检查：至少 `pnpm lint`；如实现改动影响构建，再运行 `pnpm build`。
