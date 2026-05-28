# 执行计划 - 彻底移除右侧边栏设置与概要标签页

本执行计划对应 OpenSpec 变更：`remove-right-sidebar-outline`。

## 目标与停止条件

- **目标**：彻底移除右侧边栏的“设置/概要”标签页及相关逻辑，默认激活“文件”页，仅保留“文件”与“应用”两个标签页。
- **停止条件**：
  - 侧边栏只有“文件”和“应用”两个 Tab。
  - 默认打开或切换模式时均选中“文件”页。
  - 完成 `pnpm lint` 校验无错误。
  - 完成 `pnpm build` 确认项目可以正常构建。
  - 手动验证无误。

## 依赖与前提条件

- 无

## 实施步骤

### 步骤 1：重构 `ChatRightSidebar.vue` 逻辑与模板
- **目标文件**：`app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue`
- **修改详情**：
  1. 将 `activeTab` 类型设为 `"files" | "app"`，初始值为 `"files"`。
  2. 更改 watch `() => props.mode`，设为 `"files"`。
  3. 移除无用的“设置/概要”相关计算属性。
  4. 更新 `<template>`：
     - 移除 `NavigationMenuItem` 中的“设置”标签页项。
     - 移除内容区 `<ScrollArea v-if="activeTab === 'primary'"`。
     - 将文件内容的 `v-else-if="activeTab === 'files'"` 调整为 `v-if="activeTab === 'files'"`。

## 验证计划

### 1. 自动化检查
- 运行 `pnpm lint`
- 运行 `pnpm build`

### 2. 手动验证步骤
- 执行 `pnpm dev` 启动 Electron 应用。
- 查看页面，验证右侧边栏只有“文件”与“应用”两个标签页，默认选中“文件”，没有任何与“设置”或“概要”相关的界面内容。
