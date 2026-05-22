# 悬浮球 LUI 优化设计文档

## 架构与技术选型

### 1. 鼠标悬停感知与状态控制

在 `FloatingBall.vue` 组件的根容器上监听 `mouseenter` 和 `mouseleave` 事件。
定义一个 `isHovered` 状态（`ref<boolean>(false)`），配合原本的 `isStreaming`、`pendingAskUser`、`pendingApproval` 等状态。

隐藏定时器触发逻辑：
- 当任何阻塞或活跃状态（`isStreaming || pendingAskUser || pendingApproval`）为真时，必然清除定时器，且显示 LUI。
- 当活跃状态变为假，且 `isHovered` 为假时，开始启动 4 秒倒计时。
- 如果在倒计时期间鼠标移入（`isHovered` 变为真），清除定时器，保持 LUI 显示。
- 当鼠标移出（`isHovered` 变为假）时，重新启动 4 秒倒计时。

### 2. 宽度动态自适应方案

利用 CSS 的 flex 布局与 `w-fit` 自适应特性实现。
由于 Electron 窗口的底层透明度被设为 `transparent: true`，超出卡片大小但位于 Electron 窗口内的部分是完全透明且不可见的。

- **流式输出时物理窗口尺寸**：
  将 Electron 窗口的逻辑尺寸（`windowSize` 中的 width）增加为 `280px`（250px 最大卡片宽度 + 左右各 15px 的安全 padding）。
- **LUI 卡片容器样式**：
  设置卡片容器（即包含 `scrollContainer` 样式的 div）为：
  - `w-fit`
  - `min-w-[100px]`
  - `max-w-[250px]`
- **物理对齐逻辑**：
  当悬浮球位于屏幕左侧（`isLeftExpand === true`）时，LUI 应该相对于球靠左侧对齐（即靠左对齐向右展开）。卡片父容器上应用 `items-start`。
  当悬浮球位于屏幕右侧（`isLeftExpand === false`）时，LUI 应该相对于球靠右侧对齐（即靠右对齐向左展开）。卡片父容器上应用 `items-end`。
  这确保了不论悬浮球位于何处，卡片都不会因为超出物理窗口而发生截断，并且自适应缩放的方向始终指向球的反方向。

### 3. Markdown 渲染集成

`@willow/ui` 包中已经封装并导出了 `MarkdownBlock` 组件，它完美支持了 Github Markdown 渲染、Katex 数学公式、多语言代码块（通过 `CodeBlock`）、文件/技能标签的 post-mount createApp 挂载。

- **依赖项引入**：
  在 `FloatingBall.vue` 中直接导入 `MarkdownBlock`：
  ```typescript
  import { AskUserPanel, PermissionApprovalPanel, MarkdownBlock } from "@willow/ui";
  ```
- **CSS 样式补充**：
  `MarkdownBlock` 渲染的内容类名为 `.markdown-body.markdown-content`。其全部样式均定义在 `packages/ui/src/style.css` 中（内部引入了 `github-markdown-css` 和 `katex` 的样式）。
  我们只需在 `app/work/src/renderer-floating-ball/style.css` 中增加：
  ```css
  @import "../../../../packages/ui/src/style.css";
  ```
  即可解决 Markdown 的全部渲染样式缺失问题。

- **模板替换**：
  在 `<template>` 中，当 `lastDisplayContent.type` 为 `'thinking'` 或 `'text'` 时，将原有纯文本显示节点替换为 `<MarkdownBlock>` 节点：
  ```html
  <div v-if="lastDisplayContent.type === 'thinking'">
    <MarkdownBlock :content="lastDisplayContent.text || ''" :is-thinking="true" />
  </div>
  <div v-else>
    <MarkdownBlock :content="lastDisplayContent.text || ''" />
  </div>
  ```
