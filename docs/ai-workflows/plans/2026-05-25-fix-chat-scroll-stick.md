# 执行计划：fix-chat-scroll-stick

**变更**：`docs/ai-workflows/openspec/changes/fix-chat-scroll-stick/`
**日期**：2026-05-25
**目标文件**：`app/work/src/renderer/src/pages/chat/session/Session.vue`（唯一）

---

## 前置条件

- 已读 proposal.md、spec.md、design.md、tasks.md
- 已确认修改范围仅限 `Session.vue`，无外部依赖变化
- `Button` 可从 `@willow/shadcn` 导入；`ArrowDown` 从 `lucide-vue-next` 导入；`Transition` 是 Vue 3 内置组件，无需导入

## 执行步骤

### 步骤 1：修复 `scrollToBottom` 竞态（T1）

**修改**：在 `scrollToBottom()` 函数顶部增加 `shouldStickToBottom` 守卫。

**改之前**（L104-110）：
```ts
function scrollToBottom() {
  const el = scrollArea.value;
  if (!el) {
    return;
  }
  el.scrollTop = el.scrollHeight;
}
```

**改之后**：
```ts
function scrollToBottom() {
  if (!shouldStickToBottom.value) return;
  const el = scrollArea.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}
```

**新增**：`forceScrollToBottom()` 函数供 session 切换和按钮点击调用（这些场景需要无条件滚动到底部）：
```ts
function forceScrollToBottom() {
  const el = scrollArea.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}
```

**连锁修改**：将 `sessionId` watcher 中的 `scheduleScrollToBottom()` 改为使用 `forceScrollToBottom()` 的调度版本，确保切换 session 时的滚动不被守卫拦截：
```ts
watch(
  sessionId,
  () => {
    shouldStickToBottom.value = true;
    void nextTick(() => {
      forceScrollToBottom();
      requestAnimationFrame(() => {
        forceScrollToBottom();
      });
    });
  },
  { immediate: true },
);
```

**验证**：代码无语法错误；已有滚动行为（非流式场景）不受影响。

---

### 步骤 2：添加 `handleScrollToBottom` 函数（T4）

**新增**：在 `handleScroll` 函数下方添加：
```ts
function handleScrollToBottom() {
  shouldStickToBottom.value = true;
  forceScrollToBottom();
}
```

使用 `forceScrollToBottom()` 而非 `scrollToBottom()`，因为后者有守卫但此时 `shouldStickToBottom` 刚设为 `true`（同步），所以用 `scrollToBottom()` 也能工作——为语义清晰，仍用 `forceScrollToBottom()`。

---

### 步骤 3：添加导入（T3 前置）

**修改** `<script setup>` 的 import 区：

1. 在 `import { computed, nextTick, ... } from "vue"` 中无需改动（`Transition` 是内置组件，不需 import）
2. 新增：
```ts
import { Button } from "@willow/shadcn";
import { ArrowDown } from "lucide-vue-next";
```

---

### 步骤 4：调整 template 结构 + 添加浮动按钮（T2 + T3）

**修改** template 中 `v-else` 分支（L198-217），用 `relative` 容器包裹滚动区域并添加按钮：

```vue
<div v-else class="relative min-h-0 w-full flex-1">
  <div ref="scrollArea" class="h-full overflow-y-auto pt-4 pb-10">
    <div ref="messageContainer" class="mx-auto flex max-w-3xl flex-col gap-3 px-4">
      <MessageList ... />
      <StreamingMessageContainer v-if="props.isStreaming" ... />
    </div>
  </div>

  <Transition name="scroll-bottom">
    <Button
      v-if="!shouldStickToBottom && !showWelcome"
      variant="outline"
      size="icon"
      class="absolute bottom-4 left-1/2 z-10 size-8 -translate-x-1/2 rounded-full bg-background shadow-sm"
      @click="handleScrollToBottom"
    >
      <ArrowDown class="size-4" />
    </Button>
  </Transition>
</div>
```

**关键变化**：
- 原来 `scrollArea` div 是 `flex-1`，现在外层 `relative` 容器承担 `flex-1`，内层 `scrollArea` 改为 `h-full`
- 浮动按钮通过 `absolute` 定位在外层容器中

---

### 步骤 5：添加过渡动画 CSS（T5）

在 `Session.vue` 底部新增 `<style scoped>` 块：

```vue
<style scoped>
.scroll-bottom-enter-active,
.scroll-bottom-leave-active {
  transition: opacity 200ms, transform 200ms;
}
.scroll-bottom-enter-from,
.scroll-bottom-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
```

---

### 步骤 6：静态验证（T7 部分）

1. `pnpm lint` — 确认无 lint 错误
2. `pnpm build` — 确认构建通过

**停止条件**：lint 和 build 均通过。如有错误，修复后重跑。

---

### 步骤 7：手动运行验证（T6 + T7 剩余）

使用 `pnpm dev` 启动应用，进入聊天会话，触发 AI 流式输出，验证以下场景：

| # | 场景 | 预期行为 |
|---|------|----------|
| 1 | 流式输出中不操作 | 消息区自动滚动到底部，无按钮 |
| 2 | 流式输出中向上滚动 | 视口停留在用户滚动位置，不被拉回；出现"↓"按钮 |
| 3 | 在场景 2 中点击按钮 | 立即回到底部，按钮消失，后续输出恢复自动滚动 |
| 4 | 在场景 2 中手动滚到底部 | 按钮消失，恢复自动滚动 |
| 5 | 切换 session | 滚到底部，按钮隐藏，`shouldStickToBottom` 重置为 `true` |
| 6 | 非流式状态（输出完成） | 滚动行为正常，不在底部时按钮显示 |

**停止条件**：6 个场景全部通过。

---

## 依赖与假设

- `Button` 已从 `@willow/shadcn` 统一导出（已确认）
- `ArrowDown` 在 `lucide-vue-next` 中可用（标准图标）
- Vue 3 `<Transition>` 内置可用，不需导入
- 当前 `Session.vue` 无 `<style>` 块，新增 `<style scoped>` 不会冲突

## 风险

- **低**：`relative` 容器层级变化可能影响 flex 布局 — 通过 `min-h-0 flex-1` 传递确保不影响
- **低**：`forceScrollToBottom` 与 `scrollToBottom` 功能重叠 — 接受这一微小冗余，换取语义清晰

## 下一步

进入 `workflow-implement` 执行实施。
