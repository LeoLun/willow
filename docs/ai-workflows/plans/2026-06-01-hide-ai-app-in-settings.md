# 执行计划 - 在打开设置页面或弹窗时隐藏 AI 应用视图

## 目标

- 在设置界面或任意弹窗显示时，隐藏处于“应用”标签页下的 AI 应用视图 (`WebContentsView`)，避免其作为 Native 视图覆盖设置页面或弹窗的 HTML 内容。
- 返回应用页面或关闭弹窗后，若侧边栏仍打开且处于“应用”标签页，则自动恢复 AI 应用视图的显示并校准位置。

## 任务分解与执行步骤

### 1. 修改右侧侧边栏组件

- **目标文件**：`app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue`
- **具体修改**：
  - 从 `vue-router` 引入 `useRoute`。
  - 从 `@/layout/dialog/use-dialog` 引入 `useDialog`。
  - 创建一个计算属性 `isSettingsOpen`，通过 `route.matched.some(record => record.meta.layout === 'settings')` 判断是否进入了设置页面。
  - 创建一个计算属性 `isDialogOpen`，通过 `dialogState.value?.open ?? false` 判断是否有弹窗处于打开状态。
  - 将 Vue `watch` 监听器 `watch([activeTab, () => props.open], ...)` 修改为 `watch([activeTab, () => props.open, isSettingsOpen, isDialogOpen], ...)`。
  - 在该监听回调中，将 `shouldShow` 的判断逻辑修改为 `newTab === 'app' && isOpen && !isSettings && !isDialog`。
  - 这样，当进入设置页或任意弹窗打开时，`shouldShow` 将变为 `false`，从而自动触发 `hideApp()`。当状态恢复时，`shouldShow` 变为 `true`，触发 `showApp()` 恢复显示。

### 2. 静态验证

- **规范与类型检查**：在工作区运行 `pnpm lint` 确保无 OxLint 报错，无类型引入错误。
- **打包验证**：在工作区运行 `pnpm build` 确认项目正常编译。

### 3. 手动验证

- **运行应用**：运行 `pnpm dev` 启动 Electron 桌面应用。
- **测试场景**：
  1. 在 Chat 页面的右侧侧边栏中切换到“应用”标签页。
  2. 确认 AI 应用显示正常。
  3. 点击左下角的“设置”按钮进入设置页。
  4. **预期结果**：设置页面完整展示，右侧无 AI 应用视图覆盖。
  5. 点击设置页左上角的“返回应用”返回 Chat 页面，确认 AI 应用视图正常恢复显示且位置与侧边栏对齐。
  6. 打开任意弹窗（如点击工作空间的文件树里的某个操作，或者点击新建工作区），确认弹窗弹出时，AI 应用自动隐藏。
  7. 关闭弹窗后，AI 应用自动重新显示。

