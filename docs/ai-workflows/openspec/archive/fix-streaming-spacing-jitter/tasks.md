# 修复流式输出间距跳动问题 - 任务列表

## 1. 规格定义
- [x] 1.1 整理并提交 OpenSpec (Proposal, Design, Tasks)

## 2. 代码修改
- [x] 2.1 修改 `packages/ui/src/components/AssistantMessage.vue`，在 `orderedParts` 中对 `text` 和 `thinking` 块进行 `trimEnd()`
- [x] 2.2 修改 `packages/ui/src/components/StreamingMessageContainer.vue`，优化 `props.message` 的 watch 监听逻辑，移除 `requestAnimationFrame` 并改为同步赋值，提升性能并确保状态同步
- [x] 2.3 修改 `app/work/src/renderer/src/pages/chat/session/Session.vue`，给 `messageContainer` 外层 div 添加 `flex flex-col gap-3` 布局

## 3. 验证
- [x] 3.1 运行 `pnpm lint` 检查代码规范
- [x] 3.2 运行 `pnpm build` 确认项目构建成功
- [x] 3.3 手动运行 `pnpm dev` 验证 AI 对话流式输出中的工具间距表现，确认不再出现间距跳动
