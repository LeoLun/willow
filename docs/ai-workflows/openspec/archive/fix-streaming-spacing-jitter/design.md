# 修复流式输出间距跳动问题 - 设计方案

## 1. 文本块末尾空白字符处理

在 `packages/ui/src/components/AssistantMessage.vue` 中，`orderedParts` 的计算将消息的 content 数组解析成文本、思考、工具卡片等分片：
```typescript
const orderedParts = computed(() => {
  const parts: Array<{
    type: "text" | "thinking" | "toolCall";
    key: string;
    data: any;
  }> = [];

  let idx = 0;
  for (const chunk of props.message.content) {
    if (chunk.type === "text" && chunk.text.trim() !== "") {
      parts.push({ type: "text", key: `text-${idx}`, data: chunk.text.trimEnd() });
    }
    ...
```
我们将原本的 `data: chunk.text` 变更为 `data: chunk.text.trimEnd()`。
这样当 `MarkdownBlock` 渲染 markdown 内容时，末尾多余的 `\n` 或空格会被截断，避免 `marked` 渲染出多余的空白或空的 HTML 元素导致撑高容器。

同时，我们还要在 `ThinkingBlock` 的 `chunk.thinking` 也加上类似的处理：
```typescript
    } else if (chunk.type === "thinking" && chunk.thinking.trim() !== "") {
      parts.push({
        type: "thinking",
        key: `thinking-${idx}`,
        data: chunk.thinking.trimEnd(),
      });
```

## 2. 状态更新同步机制

在 `packages/ui/src/components/StreamingMessageContainer.vue` 中，当前的 `props.message` 监听使用了 `requestAnimationFrame` 进行深拷贝：
```typescript
watch(
  () => props.message,
  (newMsg) => {
    if (newMsg === null) {
      immediateUpdate = true;
      displayMessage.value = null;
      updateScheduled = false;
      return;
    }

    if (!updateScheduled) {
      updateScheduled = true;
      requestAnimationFrame(() => {
        if (!immediateUpdate && props.message !== null) {
          displayMessage.value = JSON.parse(JSON.stringify(props.message));
        }
        updateScheduled = false;
        immediateUpdate = false;
      });
    }
  },
  { deep: true, immediate: true },
);
```
在流式输出非常快时，`JSON.parse(JSON.stringify)` 有严重的性能损耗。而且 `requestAnimationFrame` 延迟 1 帧更新 `displayMessage` 导致了 `displayMessage` 和其他 Props（例如 `pendingToolCalls`, `isStreaming`）不同步。
我们将直接在 `watch` 内进行同步赋值，以保证状态更新完全一致：
```typescript
watch(
  () => props.message,
  (newMsg) => {
    displayMessage.value = newMsg;
  },
  { deep: true, immediate: true },
);
```

## 3. 历史消息列表与流式消息容器的间距一致性

在 `app/work/src/renderer/src/pages/chat/session/Session.vue` 中，`MessageList` 与 `StreamingMessageContainer` 作为 `messageContainer` 的同级子节点：
```html
<div ref="messageContainer" class="mx-auto max-w-3xl px-4">
  <MessageList ... />
  <StreamingMessageContainer ... />
</div>
```
我们在外层包裹的容器上加入 `flex flex-col gap-3` 样式：
```html
<div ref="messageContainer" class="mx-auto max-w-3xl px-4 flex flex-col gap-3">
```
这使得：
- 当消息流处于 `StreamingMessageContainer` 渲染时，它与上方的 `MessageList`（最后一个 User 消息）之间存在 12px (`gap-3`) 的间距；
- 当消息流结束后被存入 `MessageList` 渲染时，它与上方的 User 消息之间依然由 `MessageList` 的 `gap-3` 保持 12px 间距。
由此实现了无缝的生命周期交替，消除了渲染源切换引发的 0px 到 12px 间距跳变。

## 4. 验证方案

- 在 AI 对话页面，触发一个包含工具调用的长流式回复。
- 观察子 Agent 执行生命周期各个阶段（流式委派启动 -> 委派执行中 -> 委派执行回复 -> 结束）的垂直间距。
- 确保卡片与其上方的 User 消息间距始终为 12px，没有任何大小变动或位移。
