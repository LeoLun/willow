# resizable-right-sidebar

## Summary

Chat 页面右侧侧边栏支持用户通过拖拽分隔条自由调整宽度，替代当前固定的 320px 宽度，并记住用户调整后的宽度偏好。

## Problem

当前右侧侧边栏 `ChatRightSidebar` 宽度固定为 `w-80`（320px），不可调整：

- 文件树深层嵌套时内容被截断，用户无法展开查看更多。
- 宽屏显示器上 320px 显得过窄，空间利用率低。
- 小屏设备上 320px 可能过宽，挤压中间聊天区域。
- 用户无法根据自己的偏好调整信息密度。

## Goals

- 在右侧侧边栏与主内容区之间添加可拖拽的分隔条。
- 拖拽时实时调整侧边栏宽度，释放鼠标时固定宽度。
- 宽度范围限制：最小 240px，最大 600px。
- 用户调整后的宽度持久化到 localStorage，下次打开时恢复。
- 双击分隔条恢复默认宽度（320px）。
- 侧边栏关闭/打开状态不受拖拽影响，toggle 按钮行为不变。
- 拖拽过程中主内容区自适应填充剩余宽度。

## Non-Goals

- 本次不修改左侧 `LeftSidebar` 的宽度行为。
- 本次不修改侧边栏内部内容布局或组件。
- 本次不引入全局可拖拽布局系统，仅针对右侧侧边栏。

## Success Criteria

- 拖拽分隔条可流畅调整右侧侧边栏宽度，无卡顿或闪烁。
- 宽度在 240px-600px 范围内有效，超出范围自动钳位。
- 刷新页面后宽度偏好保留。
- 双击分隔条恢复至 320px。
- Toggle 按钮仍然可以正常打开/关闭侧边栏，打开时使用用户上次调整的宽度。
- 通过 `pnpm lint` 和 `pnpm build` 检查。

## Viable Approaches

### Approach A: composable + 内联分隔条（推荐）

在 `Chat.vue` 中使用一个轻量 `useDragResize` composable，在主内容区和侧边栏之间插入分隔条元素。composable 管理 mousedown/mousemove/mouseup 事件和宽度状态持久化。

优点：
- 实现简单，不引入新依赖。
- composable 可复用于未来其他可拖拽面板。
- 与现有 CSS transition 机制兼容。

缺点：
- 需要处理拖拽与 transition 的冲突（拖拽时禁用 transition）。

### Approach B: 第三方 splitter 库

引入 `splitpanes` 或类似 Vue 分栏库。

优点：
- 开箱即用，功能完善。

缺点：
- 增加 bundle 体积。
- 样式可能与现有设计系统冲突。
- 过度设计——当前只需要一个可拖拽分隔条。

### Approach C: CSS `resize` 属性

使用 CSS `resize: horizontal` 让侧边栏自身可拖拽。

优点：
- 零 JS 实现。

缺点：
- 浏览器默认 resize handle 样式不可定制，与设计系统不协调。
- 无法持久化宽度。
- 无法限制 min/max 宽度。
- 拖拽行为受限，体验差。

## Recommendation

采用 **Approach A（composable + 内联分隔条）**。

理由：
- 最轻量，不引入新依赖。
- 完全可控的拖拽行为和样式。
- composable 可复用。
- 符合项目"简洁优先"的原则。

## Next Step

进入 `workflow-plan`，基于本变更写出实现计划。
