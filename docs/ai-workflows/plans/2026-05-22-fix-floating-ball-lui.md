# Execution Plan: 修复悬浮球 LUI 自动隐藏与 MD 渲染并自适应宽度

此计划对应 OpenSpec 变更 `fix-floating-ball-lui`。

## 1. 任务背景与目标

1. **悬浮球 LUI 自动隐藏优化**：鼠标悬停在悬浮球 LUI 上时不自动隐藏，离开后重新开始 4 秒计时隐藏。
2. **悬浮球 LUI 增加 MD 渲染**：将 LUI 的文本流式输出转换为 Markdown 格式渲染。
3. **LUI 框宽度自适应**：限制 LUI 宽度在 100px - 250px 之间，并根据内容自适应大小且对齐方向正确。

## 2. 实施步骤

### 2.1 引入样式与依赖
- 在 [style.css](file:///Users/liujinglun/code/willow/app/work/src/renderer-floating-ball/style.css) 中新增一行 `@import "../../../../packages/ui/src/style.css";`。
- 在 [FloatingBall.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer-floating-ball/FloatingBall.vue) 的 script setup 顶部，修改从 `@willow/ui` 的导入：
  ```typescript
  import { AskUserPanel, PermissionApprovalPanel, MarkdownBlock } from "@willow/ui";
  ```

### 2.2 鼠标悬停状态处理与自动隐藏重构
- 在 `FloatingBall.vue` 的 script setup 中，声明 `const isHovered = ref(false);`。
- 编写事件处理函数：
  ```typescript
  function handleMouseEnter() {
    isHovered.value = true;
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function handleMouseLeave() {
    isHovered.value = false;
    startCloseTimerIfNeeded();
  }

  function startCloseTimerIfNeeded() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    if (!isStreaming.value && !pendingAskUser.value && !pendingApproval.value && !isHovered.value) {
      closeTimer = setTimeout(() => {
        showLUI.value = false;
        closeTimer = null;
      }, 4000);
    }
  }
  ```
- 更新 `watch` 流式传输/审批状态的变化，如果状态均不活跃，调用 `startCloseTimerIfNeeded()`：
  ```typescript
  watch(
    [isStreaming, pendingAskUser, pendingApproval],
    ([streaming, askUser, approval]) => {
      if (streaming || askUser || approval) {
        if (closeTimer) {
          clearTimeout(closeTimer);
          closeTimer = null;
        }
        showLUI.value = true;
      } else {
        startCloseTimerIfNeeded();
      }
    },
    { immediate: true },
  );
  ```
- 在 `handleCloseLUI` 函数中，也要清理定时器：
  ```typescript
  function handleCloseLUI() {
    showLUI.value = false;
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }
  ```
- 在 `<template>` 的根容器 `div.floating-ball-container` 上绑定事件：
  ```html
  @mouseenter="handleMouseEnter"
  @mouseleave="handleMouseLeave"
  ```

### 2.3 物理窗口尺寸调整与自适应宽度对齐
- 修改 `windowSize` 中 `lastDisplayContent.value` 激活时的宽度，由原 `250` 改为 `280`：
  ```typescript
  if (lastDisplayContent.value) {
    return { width: 280, height: 180, focusable: false };
  }
  ```
- 修改 `<template>` 中 LUI Card 的父容器，使其根据 `isLeftExpand` 应用对齐：
  ```html
  <div
    v-if="showLUI && (lastDisplayContent || pendingAskUser || pendingApproval)"
    class="no-drag-region mb-3 flex min-h-0 w-full flex-1 flex-col justify-end"
    :class="isLeftExpand ? 'items-start' : 'items-end'"
  >
  ```
- 修改 LUI 卡片容器的宽度类为自适应与限制：
  ```html
  <div
    ref="scrollContainer"
    class="max-h-full w-fit min-w-[100px] max-w-[250px] overflow-y-auto rounded-2xl border border-white/10 bg-black/85 p-4 text-white shadow-2xl backdrop-blur-xl"
  >
  ```

### 2.4 Markdown 渲染模板重构
- 替换原有流式输出渲染节点（`FloatingBall.vue` 第 483-496 行）：
  - 当为 `'thinking'` 时渲染 `<MarkdownBlock :content="lastDisplayContent.text || ''" :is-thinking="true" />`。
  - 当为默认文本时渲染 `<MarkdownBlock :content="lastDisplayContent.text || ''" />`。

## 3. 验证步骤

1. 编译并启动桌面应用验证运行：
   - 运行 `pnpm dev` 唤起应用。
   - 输入一段较长及较短的 Markdown 内容（例如带有代码块和粗体等格式），检查卡片宽度变化是否符合 100px - 250px 限制。
   - 检查 LUI 的富文本 Markdown 排版、颜色及样式（如代码块、链接等）是否完全渲染。
   - 验证左/右展开下的边缘自适应与对齐效果。
   - 在流式输出结束后，把鼠标悬停在 LUI 面板上，测试是否会保持显示；鼠标移出后是否会在 4 秒后隐藏。
2. 运行 oxlint：
   - `pnpm lint`
3. 运行格式化：
   - `pnpm format`
