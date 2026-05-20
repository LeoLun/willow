# 子 Agent 委派卡片 UI 重设计

## 背景

当前 `WorkspaceDelegateToolRenderer` 使用 `ToolCallCard`（Collapsible 结构），需展开才能看到执行详情和导航按钮。用户希望简化为更紧凑的行内展示，参考截图中的样式：上方标题，下方实时状态，无需展开操作。

## 需求

### 1. 移除展开/折叠态

- 不再使用 `ToolCallCard`（Collapsible），改为固定展示的行内卡片
- 上方：标题行（图标 + 标题文字 + 状态指示）
- 下方：实时展示子 Agent 当前执行步骤/状态

### 2. 添加 hover 态与导航

- 整个卡片区域 hover 时显示一个 `>` 箭头图标（ChevronRight）
- 点击箭头后跳转到对应子会话

## 参考样式

参考截图中的 UI 布局：
- 左侧：状态指示圆点（运行中为动画点，完成为实心点）
- 中间：标题 + 下方执行状态文字
- 右侧（hover 时出现）：`>` 箭头

## 范围

- 仅修改 `packages/ui/src/renderers/WorkspaceDelegateToolRenderer.vue`
- 不再依赖 `ToolCallCard.vue` 的 Collapsible 结构
- 保留现有 props 接口（`params`、`result`、`isStreaming`、`onNavigateToSession`）

## 成功标准

- 卡片无展开/折叠态，标题和状态同时可见
- hover 时右侧出现 `>` 箭头
- 点击箭头可导航至子会话
- 样式符合 DESIGN.md 的桌面工作台风格（克制、紧凑、工具型）
