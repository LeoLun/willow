# 2026-05-07-resizable-right-sidebar

## 概述

为 Chat 页面右侧侧边栏添加拖拽调整宽度功能。涉及 3 个文件：新增 `useDragResize` composable，修改 `Chat.vue` 和 `ChatRightSidebar.vue`。

## 前置条件

- OpenSpec: `docs/ai-workflows/openspec/changes/resizable-right-sidebar/`
- 无外部依赖
- 不影响其他组件

## 执行切片

### 切片 1：创建 useDragResize composable

**文件**: `app/work/src/renderer/src/composables/useDragResize.ts`（新建）

**实现步骤**:

1. 定义 `UseDragResizeOptions` 接口：
   ```ts
   interface UseDragResizeOptions {
     minWidth: number;      // 240
     maxWidth: number;      // 600
     defaultWidth: number;  // 320
     storageKey: string;    // "sidebar-width"
   }
   ```

2. 实现 `useDragResize(options)` 函数：
   - **初始宽度**: 从 `localStorage.getItem(storageKey)` 读取，解析为整数。若为 `NaN` 或不在 `[minWidth, maxWidth]` 范围内，使用 `defaultWidth`。
   - **width**: `ref<number>`，初始值为上述读取结果。
   - **isDragging**: `ref<boolean>`，初始 `false`。

3. 拖拽状态变量（非响应式，闭包内）：
   - `startX: number`
   - `startWidth: number`

4. **onMouseDown(e: MouseEvent)**:
   - `e.preventDefault()`
   - `startX = e.clientX`
   - `startWidth = width.value`
   - `isDragging.value = true`
   - `document.body.style.cursor = 'col-resize'`
   - `document.body.style.userSelect = 'none'`
   - `document.addEventListener('mousemove', onMouseMove)`
   - `document.addEventListener('mouseup', onMouseUp)`

5. **onMouseMove(e: MouseEvent)**:
   - `delta = startX - e.clientX`（向左拖=增宽，向右拖=缩窄）
   - `newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta))`
   - `width.value = newWidth`

6. **onMouseUp()**:
   - `document.removeEventListener('mousemove', onMouseMove)`
   - `document.removeEventListener('mouseup', onMouseUp)`
   - `document.body.style.cursor = ''`
   - `document.body.style.userSelect = ''`
   - `isDragging.value = false`
   - `localStorage.setItem(storageKey, String(width.value))`

7. **onDblClick()**:
   - `width.value = defaultWidth`
   - `localStorage.setItem(storageKey, String(defaultWidth))`

8. **onUnmounted 清理**: 使用 `onUnmounted(() => { ... })` 移除残留的 mousemove/mouseup 监听器并恢复 body 样式。

9. 返回值：
   ```ts
   return { width, isDragging, onMouseDown, onDblClick }
   ```

**验证**: composable 文件通过 TypeScript 编译（`pnpm lint` 无报错）。可写一个最小测试：在 App 中临时引入并渲染分隔条验证无编译期错误。

---

### 切片 2：修改 ChatRightSidebar.vue

**文件**: `app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue`

**实现步骤**:

1. **新增 `width` prop**:
   ```ts
   width: number  // 默认 320
   ```
   在 `defineProps` 的 `withDefaults` 中添加。

2. **移除 `widthClass` computed**（第 51-56 行）。改为新增一个 computed 处理内联样式：
   ```ts
   const sidebarStyle = computed(() => ({
     width: props.open ? `${props.width}px` : '0px',
     flexBasis: props.open ? `${props.width}px` : '0px',
   }));
   ```

3. **修改 `<aside>` 模板**（第 147-149 行）：
   - 保留 `min-h-0 flex-none overflow-hidden` 类
   - 移除 `transition-[width,flex-basis] duration-300 ease-in-out`
   - 移除 `:class="widthClass"`
   - 添加 `:style="sidebarStyle"`
   - 添加 `:class="{ 'transition-[width,flex-basis] duration-300 ease-in-out': !isDragging }"` —— 但 `isDragging` 需要从父组件传入

4. **新增 `isDragging` prop**:
   ```ts
   isDragging?: boolean  // 默认 false
   ```

5. **修改内部 `<Sidebar>` 组件**（第 154 行）：
   - 将 `class="h-full w-80 ..."` 的 `w-80` 改为基于 width prop 的内联样式
   - 将 `:style="{ '--sidebar-width': props.open ? '20rem' : '0rem' }"` 中的 `20rem` 改为 `${props.width / 16}rem`

**验证**: 组件 props 正确传递，TypeScript 编译通过。

---

### 切片 3：修改 Chat.vue

**文件**: `app/work/src/renderer/src/pages/chat/Chat.vue`

**实现步骤**:

1. **引入 composable**:
   ```ts
   import { useDragResize } from "@/composables/useDragResize";
   ```

2. **使用 composable**:
   ```ts
   const { width: sidebarWidth, isDragging, onMouseDown, onDblClick } = useDragResize({
     minWidth: 240,
     maxWidth: 600,
     defaultWidth: 320,
     storageKey: "sidebar-width",
   });
   ```

3. **传递新 props 给 ChatRightSidebar**（第 177-184 行）：
   - 添加 `:width="sidebarWidth"`
   - 添加 `:is-dragging="isDragging"`

4. **插入分隔条**：在 `<ChatRightSidebar>` 前添加：
   ```html
   <div
     v-if="isSidebarOpen"
     class="relative h-full w-1 shrink-0 cursor-col-resize select-none bg-transparent hover:bg-border/50 transition-colors"
     @mousedown="onMouseDown"
     @dblclick="onDblClick"
   >
     <div class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
   </div>
   ```
   - 分隔条使用 `v-if="isSidebarOpen"`，侧边栏关闭时隐藏。
   - 外层 div 4px 宽（`w-1`），透明背景，hover 时半透明显示。
   - 内层 div 是 1px 居中的竖线，颜色用 `bg-border`。

**验证**: 
- `pnpm lint` 通过
- `pnpm build` 通过

---

### 切片 4：手动功能验证

**验证清单**:

| # | 验证项 | 预期行为 |
|---|--------|----------|
| 1 | 拖拽分隔条 | 侧边栏宽度实时跟随鼠标 |
| 2 | 最小宽度 | 向左拖到极限，宽度 ≥ 240px |
| 3 | 最大宽度 | 向右拖到极限，宽度 ≤ 600px |
| 4 | 双击分隔条 | 宽度重置为 320px |
| 5 | 刷新页面 | 宽度保持上次调整值 |
| 6 | Toggle 按钮 | 正常打开/关闭，打开时使用已调整的宽度 |
| 7 | 拖拽流畅性 | 无卡顿、闪烁、文本选中 |
| 8 | 主内容区自适应 | 拖拽时主内容区自动填充空间 |

**验证方法**: `pnpm dev` 启动应用，打开一个会话，点击右上角按钮展开右侧侧边栏，拖拽分隔条验证上述行为。

---

## 执行顺序

```
切片 1 (composable) → 切片 2 (ChatRightSidebar) → 切片 3 (Chat.vue) → 切片 4 (手动验证)
```

切片 1 必须先完成，切片 2 和 3 可并行。切片 4 需要切片 1-3 全部完成。

## 风险与回滚

- **风险**: composable 忘记在 onUnmounted 清理监听器导致内存泄漏 → 切片 1 步骤 8 明确要求。
- **回滚**: 3 个文件变更，git revert 即可完全恢复。
