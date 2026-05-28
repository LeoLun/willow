# 执行计划 - 切换或新建会话时保持相同工作空间的右侧侧边栏数据不刷新

本执行计划对应 OpenSpec 变更：`keep-sidebar-on-same-workspace`。

## 目标与停止条件

- **目标**：当且仅当切换前后属于相同的工作空间时，右侧侧边栏的工作空间数据（文件树、设置、MCP 状态、打开的预览文件）均不发生重新加载或状态清除。
- **停止条件**：
  - 代码中已正确实现 `stableWorkspaceId`。
  - 完成 `pnpm lint` 校验无错误。
  - 完成 `pnpm build` 确认项目可以正常构建。
  - 手动验证通过：切换同一工作空间下的会话时无闪烁、不折叠已展开的文件树、不关闭已打开的文件预览；切换至其他工作空间时，侧边栏能够正常载入并刷新新工作空间的数据。

## 依赖与前提条件

- 无

## 实施步骤

### 步骤 1：重构 `ChatRightSidebar.vue` 传参与监听
- **目标文件**：`app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue`
- **修改详情**：
  1. 定义 `stableWorkspaceId`：
     ```typescript
     const stableWorkspaceId = ref(workspaceId.value);
     watch(
       workspaceId,
       (newId) => {
         if (newId && newId !== 0) {
           stableWorkspaceId.value = newId;
         }
       },
       { immediate: true },
     );
     ```
  2. 将 `useWorkspaceFiles(workspaceId)` 中的参数改为 `stableWorkspaceId`：
     ```typescript
     const {
       files,
       rootPath,
       isLoading: isFilesLoading,
       errorMessage: filesErrorMessage,
       refresh: refreshFiles,
     } = useWorkspaceFiles(stableWorkspaceId);
     ```
  3. 将 `useWorkspaceSettings(toRef(workspaceId))` 中的参数改为 `stableWorkspaceId`：
     ```typescript
     const {
       workspacePath,
       soulContent,
       isSaving,
       errorMessage: settingsErrorMessage,
       saveMessage,
       saveSettings,
     } = useWorkspaceSettings(stableWorkspaceId);
     ```
  4. 将监听 `workspaceId` 并调用 `mcpStore.fetchWorkspaceServers` 的 watcher 改为监听 `stableWorkspaceId`：
     ```typescript
     watch(
       stableWorkspaceId,
       (newId) => {
         if (newId && props.mode === "workspace") {
           mcpStore.fetchWorkspaceServers(newId);
         }
       },
       { immediate: true },
     );
     ```
  5. 将重置选中文件状态的 watcher 改为监听 `[stableWorkspaceId, activeTab]`：
     ```typescript
     watch([stableWorkspaceId, activeTab], () => {
       selectedFilePath.value = null;
       selectedFileName.value = null;
     });
     ```
  6. 修改 `<template>` 中的子组件传参：
     - `<WorkspaceFileTree :items="files" :workspace-id="stableWorkspaceId" />`
     - `<InlineFileViewer :workspace-id="stableWorkspaceId" ... />`

## 验证计划

### 1. 自动化检查
- 运行 `pnpm lint`。
- 运行 `pnpm build`。

### 2. 手动验证步骤
- 执行 `pnpm dev` 启动 Electron 桌面应用。
- 选择某个工作空间下的一个会话，打开右侧侧边栏，切换到“文件”标签页，点击展开其目录树中的若干子目录，并双击打开任意文件进行预览。
- 在左侧侧边栏中切换到同一工作空间下的另一个会话。
- **预期结果**：右侧侧边栏的“会话信息”随之更新，但“文件”标签页保持现状，原先展开的文件树目录未折叠，右侧的预览文件未关闭，且没有任何数据重新加载的 Loading 动画。
- 在左侧侧边栏中切换到另外一个工作空间下的会话，或切换到一个未指定工作空间的空白会话。
- **预期结果**：右侧侧边栏数据正常刷新并正确载入对应工作空间（或清空）的文件列表。
