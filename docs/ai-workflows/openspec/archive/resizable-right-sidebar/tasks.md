# tasks

## 1. 创建 useDragResize composable

- [x] 新建 `app/work/src/renderer/src/composables/useDragResize.ts`
- [x] 实现 `useDragResize` 函数：接收 `minWidth`, `maxWidth`, `defaultWidth`, `storageKey` 配置
- [x] 从 localStorage 读取初始宽度，无存储值时使用 `defaultWidth`
- [x] 实现 mousedown 处理：记录起始位置，在 document 上注册 mousemove/mouseup
- [x] 实现 mousemove 处理：计算新宽度，钳位到 [minWidth, maxWidth]
- [x] 实现 mouseup 处理：清理 document 监听器，持久化宽度到 localStorage
- [x] 实现双击处理：重置宽度为 `defaultWidth`，持久化
- [x] 拖拽中 body 添加 `cursor: col-resize` 和 `user-select: none`
- [x] onUnmounted 清理残留监听器

## 2. 修改 Chat.vue

- [x] 引入 `useDragResize` composable
- [x] 用 `sidebarWidth` ref 替换现有 `isSidebarOpen` 相关的宽度逻辑
- [x] 在主内容区与 ChatRightSidebar 之间插入分隔条元素
- [x] 分隔条绑定 `handleProps`（onMousedown, onDblclick）
- [x] 传递 `:width` prop 给 ChatRightSidebar
- [x] 分隔条在侧边栏关闭时隐藏（`v-if="isSidebarOpen"`）

## 3. 修改 ChatRightSidebar.vue

- [x] 新增 `width` prop（number, 默认 320）
- [x] 移除 `widthClass` computed
- [x] 将 aside 的 class 改为基于 `width` prop 和 `open` 的内联样式
- [x] 同步更新内部 Sidebar 的 `--sidebar-width` CSS 变量
- [x] 保留关闭/打开的 transition 效果（拖拽中禁用 transition）
- [x] 移除 Sidebar 上的 `border-l border-border`，避免与分隔条双线

## 4. 验证

- [x] 拖拽分隔条，侧边栏宽度实时变化
- [x] 宽度在 240px-600px 范围内有效
- [x] 双击分隔条恢复 320px 默认宽度
- [x] 刷新页面后宽度偏好保持
- [x] Toggle 按钮正常打开/关闭侧边栏
- [x] 拖拽过程中主内容区自适应填充
- [x] `pnpm lint` 通过
- [x] `pnpm build` / `tsc --noEmit` 通过
