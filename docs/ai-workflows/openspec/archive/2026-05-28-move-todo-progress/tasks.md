# 任务列表

## 1. 调整右侧边栏组件
- 编辑 `app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue`。
- 移除与 `props.todos` 展示相关的 DOM 结构（进度条、任务进度标题及 Todo 项目列表）。
- 保持 `props.todos` 的定义（若暂不移除，避免破坏外部调用传递，但不再进行渲染）。

## 2. 调整主聊天页面组件
- 编辑 `app/work/src/renderer/src/pages/chat/Chat.vue`。
- 引入 `TodoProgress` 组件。
- 在底部面板容器（包裹了 `AskUserPanel` / `PermissionApprovalPanel` / `SenderContainer` 的 `<div class="relative w-full max-w-3xl min-w-0 pr-3">`）内部上方添加 `<TodoProgress>`：
  ```vue
  <TodoProgress
    v-if="isSessionRoute && todos.length > 0"
    :todos="todos"
    class="mb-2"
  />
  ```
- 确保相关导入和逻辑均正确引用。

## 3. 验证与测试
- 运行 `pnpm lint` 确保没有 Lint 问题。
- 运行 `pnpm build` 确认项目构建无误。
- 运行 `pnpm dev` 并在应用内触发一个需要工具/任务执行的 Session，验证 Todo 进度组件在输入框上方能够正确显示、展示进度、可折叠/展开，并确认右侧边栏中的旧 Todo 界面已被移除。
