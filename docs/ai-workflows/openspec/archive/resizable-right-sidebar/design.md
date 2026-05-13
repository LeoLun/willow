# design

## 架构

```
Chat.vue (宽度状态 owner)
  ├── useDragResize(options) → { width, resizeHandleProps, isDragging }
  ├── 主内容区 (flex-1, 自适应)
  ├── 分隔条 (4px, col-resize cursor)
  └── ChatRightSidebar (接收 :width prop)
```

## 数据流

```
localStorage("sidebar-width")
  │
  ▼
Chat.vue: sidebarWidth = ref(readFromStorage() ?? 320)
  │
  ├──▶ 主内容区: flex: 1 (自动填充剩余空间)
  │
  ├──▶ 分隔条: @mousedown → useDragResize.startDrag()
  │         useDragResize 内部:
  │           mousemove → 计算新宽度 → sidebarWidth.value = clamp(newWidth, 240, 600)
  │           mouseup   → localStorage.set("sidebar-width", sidebarWidth.value)
  │
  └──▶ ChatRightSidebar: :style="{ width: open ? sidebarWidth + 'px' : '0px' }"
```

## ChatRightSidebar 修改

- 移除 `widthClass` computed（`w-80`/`w-0` 切换）。
- 移除 CSS transition 类（`transition-[width,flex-basis]`），改为由父组件控制。
- 新增 `width` prop（number），用于绑定当前宽度。
- 内部 `Sidebar` 组件的 `--sidebar-width` CSS 变量同步更新。
- 当 `open=false` 时宽度为 0，当 `open=true` 时宽度为 `width` prop 值。

## useDragResize composable

```ts
// composables/useDragResize.ts
function useDragResize(options: {
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  storageKey: string;
  onWidthChange?: (width: number) => void;
}) {
  // 返回:
  // - width: Ref<number>
  // - isDragging: Ref<boolean>
  // - handleProps: { onMousedown, onDblclick }
  // - resetWidth: () => void
}
```

### 实现细节

- `onMousedown`：记录 `startX`, `startWidth`，在 `document` 上注册 `mousemove` 和 `mouseup` 监听器。
- `onMousemove`：`delta = startX - e.clientX`，`newWidth = clamp(startWidth + delta, min, max)`。
- `onMouseup`：移除监听器，写 localStorage。
- `onDblclick`：重置为 `defaultWidth`，写 localStorage。
- 拖拽中 body 添加 `cursor-col-resize` + `select-none` 类，结束时移除。
- `onUnmounted` 时清理残留的 document 监听器。

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `composables/useDragResize.ts` | 新增 | 拖拽调整宽度 composable |
| `pages/chat/Chat.vue` | 修改 | 使用 useDragResize，传递宽度 prop |
| `pages/chat/components/ChatRightSidebar.vue` | 修改 | 接收 width prop，替换固定宽度逻辑 |

## 风险

- 拖拽时与 sidebar transition 冲突 → 解决方案：拖拽中通过 class 禁用 transition。
- 快速拖拽可能触发文本选择 → 解决方案：拖拽中 body 添加 `user-select: none`。
