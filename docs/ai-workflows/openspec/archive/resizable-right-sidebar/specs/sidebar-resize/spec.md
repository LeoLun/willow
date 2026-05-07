# sidebar-resize

## 功能描述

右侧侧边栏支持用户通过拖拽分隔条自由调整宽度。

## 行为规格

### 分隔条

- 分隔条位于主内容区与右侧侧边栏之间，宽度 4px，hover 时显示高亮光标样式 `col-resize`。
- 分隔条在侧边栏关闭（`open=false`）时隐藏。
- 分隔条在视觉上为一个居中的竖线指示器，颜色为 `border` token。

### 拖拽行为

- **mousedown**：记录初始鼠标 X 坐标和初始侧边栏宽度，进入拖拽状态，body 添加 `cursor: col-resize` 和 `user-select: none`。
- **mousemove**：根据鼠标位移计算新宽度 `newWidth = initialWidth + (initialMouseX - currentMouseX)`，钳位到 [240, 600]。
- **mouseup**：退出拖拽状态，移除 body 样式，持久化当前宽度。
- 拖拽过程中禁用侧边栏的 CSS transition，释放后恢复。

### 宽度持久化

- 使用 `localStorage` 存储键值 `sidebar-width`。
- 组件挂载时读取存储值作为初始宽度，无存储值时默认 320px。
- 切换侧边栏打开/关闭不重置宽度。

### 双击重置

- 双击分隔条将宽度重置为默认 320px，更新持久化值。

### 与 toggle 按钮的关系

- toggle 按钮（`ChevronLeft`/`ChevronRight`）行为不变：切换 `isSidebarOpen`。
- 打开时侧边栏宽度使用用户上次调整的值（或默认值）。
- 关闭时侧边栏宽度过渡到 0。

## 技术约束

- 使用 Vue 3 Composition API（`<script setup>`）。
- composable 放在 `app/work/src/renderer/src/composables/useDragResize.ts`。
- 不在 `ChatRightSidebar.vue` 内部实现拖拽逻辑，由父组件 `Chat.vue` 管理宽度状态并通过 props 传递。
- 分隔条样式使用 Tailwind/UnoCSS 类名。
