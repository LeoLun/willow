# 悬浮球 LUI 优化任务列表

## 1. 样式与依赖引入

- [x] 1.1 在 `app/work/src/renderer-floating-ball/style.css` 中引入 `@willow/ui` 的样式文件 `@import "../../../../packages/ui/src/style.css";`。
- [x] 1.2 在 `app/work/src/renderer-floating-ball/FloatingBall.vue` 中导入 `MarkdownBlock` 组件。

## 2. 悬停隐藏状态控制逻辑

- [x] 2.1 在根容器 div (`floating-ball-container`) 上绑定 `@mouseenter` 和 `@mouseleave` 事件，指向处理函数。
- [x] 2.2 定义 `isHovered = ref(false)` 响应式变量，在处理函数中更新此值。
- [x] 2.3 重构自动隐藏 LUI 的定时器逻辑：
  - 触发点 1：`watch([isStreaming, pendingAskUser, pendingApproval], ...)`，如果活跃，清理定时器；如果不活跃，尝试重新计时隐藏。
  - 触发点 2：在鼠标移入时清理定时器；鼠标移出时，如果当前没有处于活跃状态（未在流式传输或等待提问审批），启动 4 秒计时折叠 LUI。
  - 触发点 3：在手动调用 `handleCloseLUI` 时清除定时器。

## 3. 宽度动态自适应与对齐

- [x] 3.1 修改 `windowSize` 中 `lastDisplayContent.value` 对应的宽度，从 `250` 改为 `280`，为 LUI 卡片预留出 `250px` 的宽度空间。
- [x] 3.2 找到 LUI 卡片容器的父 div（`class="no-drag-region mb-3 flex min-h-0 w-full flex-1 flex-col justify-end"`），动态为其添加基于 `isLeftExpand` 的对齐类：
  - `:class="isLeftExpand ? 'items-start' : 'items-end'"`
- [x] 3.3 修改 LUI 卡片容器的 class，由原来的固定 `w-full` 改为 `w-fit min-w-[100px] max-w-[250px]`，以实现自适应与限制范围。

## 4. Markdown 模板渲染

- [x] 4.1 修改 LUI 展示流式输出模板部分：
  - 当 `lastDisplayContent.type === 'thinking'` 时，使用 `<MarkdownBlock :content="lastDisplayContent.text || ''" :is-thinking="true" />`。
  - 当 `lastDisplayContent.type === 'text'`（默认分支）时，使用 `<MarkdownBlock :content="lastDisplayContent.text || ''" />`。

## 5. 验证与回归

- [x] 5.1 运行 `pnpm lint` 验证有无语法与类型错误。
- [x] 5.2 运行 `pnpm dev` 启动并手动验证各项交互与显示功能。
