# 任务列表

## 1. 优化右侧侧边栏组件以支持在设置页或弹窗隐藏 AI 应用视图
- [ ] 修改 `app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue`：
  - 引入 `useRoute` 并获取当前路由实例。
  - 引入 `useDialog` 并获取当前全局弹窗状态。
  - 定义 `isSettingsOpen` 计算属性，判断当前路由是否匹配设置页布局（`meta.layout === 'settings'`）。
  - 定义 `isDialogOpen` 计算属性，判断当前是否有弹窗处于打开状态（`dialogState.value?.open ?? false`）。
  - 修改控制 AI 应用视图显示隐藏的 `watch` 监听器，将监听对象由 `[activeTab, () => props.open]` 扩展为 `[activeTab, () => props.open, isSettingsOpen, isDialogOpen]`。
  - 在监听回调中，将 `shouldShow` 的逻辑更新为：`newTab === 'app' && isOpen && !isSettings && !isDialog`。

## 2. 验证与清理
- [ ] 运行 `pnpm lint` 检查代码规范与类型。
- [ ] 运行 `pnpm build` 确保编译通过。
- [ ] 运行 `pnpm dev` 启动 Electron，进行手动测试：
  - 打开应用并确保右侧侧边栏展开且切换到“应用”标签页（AI 应用视图显示）。
  - 点击左下角“设置”按钮，验证设置页面展示时，右侧没有被 AI 应用视图覆盖。
  - 点击设置页的“返回应用”，验证回到主页面后，侧边栏的“应用”视图自动恢复显示。
  - 打开任意弹窗（例如点击新建工作空间或删除确认等弹窗），验证弹窗展示时，AI 应用视图是否自动隐藏（不覆盖弹窗）。
  - 关闭弹窗，验证 AI 应用视图自动恢复。

