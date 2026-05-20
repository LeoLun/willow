# 修复流式输出间距跳动问题

## 动机

在 AI 助手流式输出过程中，工具执行卡片与前后上下文（文本块、等待加载的 Loading 动画等）之间的间距经常发生跳动。这主要是由于：
1. 文本块在生成过程中末尾可能会有换行符（如 `\n\n`），`marked` 解析后在 `v-html` 中没有过滤掉，使得文本块本身高度偏高。当数据从流式状态切换为静态完成状态，或者数据被去除了末尾换行时，会导致工具卡片发生抖动。
2. 即使是在流式输出中，我们只保留有实质内容的 text 块，但由于 `orderedParts` 的计算以及 markdown 文本块没有做 `trimEnd` 过滤，导致了多余的高度跳动。
3. `StreamingMessageContainer` 中的消息在 streaming 时是通过 `requestAnimationFrame` 异步更新的，但其他的状态如 `pendingToolCalls`（工具是否运行）是立刻更新的。这 1 帧的延迟也有可能导致短暂的状态不一致与排版闪烁。
4. `Session.vue` 中 `MessageList` 与 `StreamingMessageContainer` 为同级 Block 元素，父容器没有定义 flex 布局和 gap。当消息在流式输出中（渲染在 `StreamingMessageContainer` 中）和结束后（移动到 `MessageList` 中）进行渲染切换时，它们与上方 User 消息之间的间距会由于 flex 容器 gap 的有无而发生从 0px 到 12px (`gap-3`) 的跳动。

## 目标

1. 确保流式输出过程中，工具卡片与上下文之间的垂直间距稳定、无多余的换行、不发生跳动。
2. 确保在流式输出结束，或者从流式转换为完成状态时，UI 没有突兀的位移。
3. 优化流式输出更新机制，避免 `requestAnimationFrame` 延迟造成的 1 帧状态不一致。
4. 保证 `MessageList` 和 `StreamingMessageContainer` 在生命周期交替时，渲染在其中的卡片与上下文始终共享相同的垂直间距（`gap-3`）。

## 范围

- 修改 `packages/ui/src/components/AssistantMessage.vue` 中的 `orderedParts` 计算逻辑，对 text 类型块在展示前进行 `trimEnd()` 过滤。
- 修改 `packages/ui/src/components/StreamingMessageContainer.vue`，优化 `watch` 中 `props.message` 的更新逻辑，使其更为流畅，移除不必要的 `requestAnimationFrame` 节流，保证状态同步。
- 修改 `app/work/src/renderer/src/pages/chat/session/Session.vue`，为消息容器加上 `flex flex-col gap-3`，使流式消息与历史消息间距一致。

## 非范围

- 不改变工具卡片的内部视觉样式。
- 不影响 AI 助手的生成逻辑。
