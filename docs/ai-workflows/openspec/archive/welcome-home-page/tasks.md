# 任务列表：设计并实现欢迎首页

## 1. 创建 WelcomeView 组件

- [ ] 在 `app/work/src/renderer/src/pages/chat/session/components/` 下新建 `WelcomeView.vue`。
- [ ] 在模板中实现三个核心卡片（创建工作空间、开启新对话、模型配置）和 3 个建议提示词。
- [ ] 引入 `useDialog` 和 `CreateWorkspace` 对话框组件，绑定快捷按钮触发逻辑。
- [ ] 引入 `useRouter` 以支持快捷配置按钮跳转到设置页面。
- [ ] 实现 `selectPrompt(text)` 方法，用来派发 `insert-prompt` 事件，传递提示词文本。
- [ ] 实现 `focusPrompt()` 方法，用来派发 `focus-prompt` 事件，聚焦到底部输入框。

## 2. 修改 SenderContainer 监听自定义事件

- [ ] 打开 `app/work/src/renderer/src/pages/chat/components/SenderContainer.vue`。
- [ ] 在 `onMounted` 中添加对 `insert-prompt` 和 `focus-prompt` 的 window 事件监听。
- [ ] 实现 `handleInsertPrompt(e)` 方法，用于更新 Tiptap 文本内容并执行 `.focus()`。
- [ ] 实现 `handleFocusPrompt()` 方法，仅用于触发聚焦行为。
- [ ] 在 `onUnmounted` / `onBeforeUnmount` 中注销对应的监听器以防内存泄漏。

## 3. 修改 Session 页面引入 WelcomeView

- [ ] 打开 `app/work/src/renderer/src/pages/chat/session/Session.vue`。
- [ ] 引入新创建的 `WelcomeView.vue`。
- [ ] 更改 `<template>` 部分，当 `props.messages.length === 0 && !props.isStreaming` 时，渲染 `WelcomeView.vue`；否则渲染原本的 `MessageList`。

## 4. 验证与清理

- [ ] 运行 `pnpm lint` 验证前端代码是否有 Lint 报错。
- [ ] 启动 `pnpm dev` 查看实际页面表现。
- [ ] 验证在无会话记录时，应用首页是否成功展示精美设计的欢迎页面。
- [ ] 验证快捷按钮：“创建工作空间”是否能成功拉起创建对话框。
- [ ] 验证快捷按钮：“去配置”是否能成功路由至设置页面。
- [ ] 验证提示词建议卡片：点击后是否将对应内容输入到底部并实现输入聚焦。
