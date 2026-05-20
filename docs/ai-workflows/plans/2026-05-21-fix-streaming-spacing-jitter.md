# 2026-05-21-fix-streaming-spacing-jitter.md

## 执行切片 1: 文本块与思考块的末尾空白过滤

### 目标

确保 `AssistantMessage` 在解析消息内容段落时，截断文本和思考块末尾的换行及空白字符，从而消除 `marked` 渲染时产生的额外高度和排版跳动。

### 影响文件

- [packages/ui/src/components/AssistantMessage.vue](file:///Users/liujinglun/code/willow/packages/ui/src/components/AssistantMessage.vue)

### 修改点

1. 在 `orderedParts` 的计算函数中，当解析到 `chunk.type === "text"` 时，将 `data` 属性设为 `chunk.text.trimEnd()`。
2. 同理，当解析到 `chunk.type === "thinking"` 时，将 `data` 属性设为 `chunk.thinking.trimEnd()`。

### 校验命令

```bash
pnpm lint
pnpm build
```

---

## 执行切片 2: 优化 Streaming 消息状态更新机制

### 目标

消除 `StreamingMessageContainer` 内部因 `requestAnimationFrame` 导致的 1 帧更新延迟，以解决状态在流式渲染与工具卡片渲染时不同步、排版闪烁的问题。

### 影响文件

- [packages/ui/src/components/StreamingMessageContainer.vue](file:///Users/liujinglun/code/willow/packages/ui/src/components/StreamingMessageContainer.vue)

### 修改点

1. 简化 `watch` 中 `props.message` 的处理。
2. 移除 `requestAnimationFrame` 封装和 `JSON.parse(JSON.stringify)`，改为直接同步将新值赋给 `displayMessage.value`。

### 校验命令

```bash
pnpm lint
pnpm build
```

---

## 执行切片 3: 优化 Session 页面消息容器布局

### 目标

确保 `MessageList` 和 `StreamingMessageContainer` 之间以及它们内部的子节点始终共享相同的垂直间距（12px），以彻底消除流式状态和已完成状态切换时的 0px 到 12px 间距跳动问题。

### 影响文件

- [app/work/src/renderer/src/pages/chat/session/Session.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer/src/pages/chat/session/Session.vue)

### 修改点

1. 在 `Session.vue` 中，为包含 `MessageList` 和 `StreamingMessageContainer` 的 `messageContainer` `div` 元素添加 `flex flex-col gap-3` 类名。

### 校验命令

```bash
pnpm lint
pnpm build
```

---

## 执行切片 4: 集成验证与测试

### 验证步骤

1. 启动 Electron 桌面应用：
   ```bash
   pnpm dev
   ```
2. 向 AI 助手发送需要调用工具的指令（例如“bill-app 上个月支出多少”）。
3. 肉眼观察流式输出过程中，工具卡片从一开始启动，到执行中（文字更新），再到子 Agent 回复，直到最后结束的完整生命周期中，它与上方 User 消息、下方 Loading 动画之间的间距。
4. 验证卡片与其上方 User 消息的间距自始至终稳定在 12px (`gap-3`)，没有任何瞬间的抖动、归零或位移。
