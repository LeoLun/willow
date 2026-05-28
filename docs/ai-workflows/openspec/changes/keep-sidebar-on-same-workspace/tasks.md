# 任务列表

## 1. 优化右侧侧边栏组件数据刷新逻辑
- [ ] 修改 `app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue`：
  - 定义一个 `stableWorkspaceId` 响应式引用，初始值为当前 `workspaceId`。
  - 监听 `workspaceId` 的变化，仅在 `newId` 存在且不为 `0` 时，更新 `stableWorkspaceId` 的值。
  - 将 `useWorkspaceFiles`、`useWorkspaceSettings` 及 `mcpStore.fetchWorkspaceServers` 传参改为 `stableWorkspaceId`。
  - 将重置选中文件路径/文件名的 `watch` 监听项改为 `[stableWorkspaceId, activeTab]`。
  - 在 `<template>` 中，将传入 `<WorkspaceFileTree>` 和 `<InlineFileViewer>` 的 `workspace-id` 属性改为 `stableWorkspaceId`。

## 2. 验证与清理
- [ ] 运行 `pnpm lint` 检查代码规范。
- [ ] 运行 `pnpm build` 确认编译正常。
- [ ] 启动应用（`pnpm dev`），在同一个工作空间下切换不同的会话、或点击新建会话，验证右侧侧边栏中的文件树展开状态、选中的预览文件等是否不发生刷新和重置。
- [ ] 切换到不同工作空间的会话，验证右侧侧边栏数据是否能够正确切换刷新。
