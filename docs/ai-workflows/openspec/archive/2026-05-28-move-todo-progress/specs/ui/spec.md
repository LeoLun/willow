# 界面设计规范 (UI Spec)

## 页面布局变更

### 1. 右侧边栏 (ChatRightSidebar.vue)
- 移除 `<h4 class="text-xs font-medium text-muted-foreground"> 任务进度 ... </h4>` 及其下方的进度条和 `v-for="todo in props.todos"` 列表区域。
- 仅保留会话基本信息（标题、创建时间、最近活跃、消息数量、工作空间）。

### 2. 底部输入框上方 (Chat.vue)
- 放置位置：在 `Chat.vue` 的底部面板容器内，即 `AskUserPanel`、`PermissionApprovalPanel`、`SenderContainer` 这一组条件渲染组件的上方。
- 渲染条件：
  - 当前必须是会话相关的路由（`isSessionRoute` 或有活跃会话）。
  - 当前 Todo 列表长度大于 0 (`todos.length > 0`)。
- 交互与折叠态：
  - 默认 `isExpanded` 为 `false`（折叠）。
  - 折叠态：展示为一行，包含：
    - 左侧 Todo 图标
    - 当前正在执行的 Todo 文本（若无 `in_progress`，展示为“任务列表”）
    - 进度数（如 `2/5`）
    - 右侧展开箭头图标 (ChevronDownIcon)
  - 展开态：通过点击触发，向下展开显示所有 Todo 项，并以列表形式展示每个 Todo 的状态图标与内容（已完成的带删除线、进行中的加粗等）。
- 样式与间距：
  - 与下方输入框或面板的间距为 `mb-2`。
  - 外观保持 `TodoProgress.vue` 自带的毛玻璃微光投影效果（`rounded-lg border border-border/60 bg-background/80 shadow-sm backdrop-blur-md`）。
