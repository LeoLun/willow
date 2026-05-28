# 任务列表

## 1. 移除右侧侧边栏中的“概要”标签页及相关代码
- [ ] 修改 `app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue`：
  - 更新 `activeTab` 默认值：如果为 `session` 模式，默认值应设为 `'files'`。
  - 在 `watch(() => props.mode)` 中，若新模式为 `session`，将 `activeTab` 设为 `'files'`；若新模式为 `workspace`，将 `activeTab` 设为 `'primary'`。
  - 移除无用的计算属性：`formattedCreatedAt`、`formattedUpdatedAt`。
  - 移除不需要的标签页名称/图标映射：如果 `mode` 始终为 `workspace` 才会用到 `primary` 标签页，我们可以直接在模板中渲染“设置”和 `Settings2Icon`，不再需要 `primaryTabLabel` 和 `primaryTabIcon` 这两个动态计算属性。
  - 修改模板：
    - 对 `primary` 标签页的 `NavigationMenuItem` 添加条件，仅在 `props.mode === 'workspace'` 时显示。
    - 在内容区，仅在 `props.mode === 'workspace'` 时渲染工作空间信息的 `primary` 视图，移除会话信息的 DOM 结构（`v-else class="space-y-4 p-3"` 那部分）。

## 2. 验证与构建
- [ ] 运行 `pnpm lint` 确保代码无 lint 错误。
- [ ] 运行 `pnpm build` 确认项目编译正常。
- [ ] 运行 `pnpm dev` 启动 Electron 桌面应用，手动验证：
  - 进入某个会话时，右侧边栏是否默认展示“文件”页，且顶部没有“概要”按钮。
  - 切换到工作空间视图或相关的 workspace 模式时，右侧边栏是否仍有“设置”按钮且默认展示设置页。
