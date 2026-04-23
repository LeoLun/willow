# Tasks

## 1. 更新标题生成触发

- [x] 1.1 在 [session.service.ts](/Users/liujinglun/code/willow/app/work/src/main/service/session.service.ts) 中复用 `priorMessageCount === 0` 作为空会话首条消息判断点。
- [x] 1.2 将既有 `createSessionTitle` 调用从首轮 `agent_end` 后移出，改为用户提交首条消息后异步触发。
- [x] 1.3 移除或禁用 `agent.subscribe(...)` 中首轮 `agent_end` 后的标题生成触发，避免重复生成。
- [x] 1.4 确保标题生成不阻塞主聊天 Agent 的发送和流式事件。

## 2. 调整标题生成输入

- [x] 2.1 改造既有 `createSessionTitle`，使其接收首条用户输入文本或等价可读文本，而不是等待会话历史中出现助手消息。
- [x] 2.2 调整标题 Agent system prompt 和用户 prompt，删除对助手首轮回复的依赖。
- [x] 2.3 保留标题截断、清洗、空结果回退和错误处理。

## 3. 保留并发安全

- [x] 3.1 写入标题前再次检查会话标题仍为空。
- [x] 3.2 验证用户手动重命名不会被自动标题生成覆盖。
- [x] 3.3 确保后续消息不会重复触发自动标题生成。

## 4. 验证

- [x] 4.1 手动验证新空会话发送首条消息后，AI 回复仍在生成时标题已开始生成或完成同步。
- [x] 4.2 手动验证长回复、工具调用或慢模型场景下标题不等待首轮 `agent_end`。
- [x] 4.3 手动验证标题模型失败或返回空内容时聊天发送不受影响，并使用回退标题。
- [x] 4.4 运行相关 lint/build 检查。
