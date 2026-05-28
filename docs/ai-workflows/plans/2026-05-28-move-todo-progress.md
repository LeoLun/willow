# 执行计划：将 Todo 进度列表移动到输入框上方

## 概述
本计划包含三个执行分片（Slices），主要涉及 Electron 前端渲染页面的组件调整。

---

## Slice 1: 移除右侧边栏的旧 Todo 展示区域

### 1.1 修改 `ChatRightSidebar.vue`
**文件**: `app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue`
- 定位到 `<div v-if="props.todos.length > 0" class="space-y-2">` 部分（约第 400-435 行）。
- 删除该 `div` 节点，将进度条与 Todo 项列表的 DOM 结构彻底移除。
- 保持 `props.todos` 属性的接收，以避免修改父组件传入逻辑，但内部不再进行渲染。

---

## Slice 2: 在聊天页面中集成并展示输入框上方的 Todo 进度

### 2.1 修改 `Chat.vue`
**文件**: `app/work/src/renderer/src/pages/chat/Chat.vue`
- 在脚本区域引入 `<TodoProgress>` 组件：
  ```typescript
  import TodoProgress from "@/components/base/TodoProgress.vue";
  ```
- 在模板中，定位到包裹 `AskUserPanel`、`PermissionApprovalPanel` 和 `SenderContainer` 的底部包裹容器 `<div class="relative w-full max-w-3xl min-w-0 pr-3">`（约第 333 行）。
- 在内部的首行位置插入 `<TodoProgress>` 组件，渲染条件为：有活跃 session 且 todos 长度大于 0。
  ```vue
  <TodoProgress
    v-if="isSessionRoute && todos.length > 0"
    :todos="todos"
    class="mb-2"
  />
  ```

---

## Slice 3: 代码检查与运行测试

### 3.1 代码规范校验与编译测试
- 在工作空间根目录下运行：
  ```bash
  pnpm lint
  pnpm build
  ```
  确保没有 Lint 或编译打包错误。

### 3.2 手动集成验证
- 运行 `pnpm dev` 启动 Electron 客户端。
- 进入包含任务执行历史的会话（或新起会话执行带有子任务的任务）。
- 确认右侧侧边栏中不再包含“任务进度”区域。
- 确认聊天主窗口底部输入框上方正确展示了 Todo 进度条（折叠状态）。
- 点击 Todo 进度条，确认能正常向下展开，并显示所有具体的 Todo 项及其完成状态。
- 测试在任务执行期间，新加或更新的 Todo 状态能够实时反馈在输入框上方组件。

---

## 文件变更清单

| 操作 | 文件 |
|------|------|
| 修改 | `app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue` |
| 修改 | `app/work/src/renderer/src/pages/chat/Chat.vue` |
