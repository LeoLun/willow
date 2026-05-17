# 悬浮球视觉效果修复 + AI 流式输出动画 — 执行计划

## 依赖关系

```
10.1 (window.ts hasShadow) ─── 独立
10.2 (FloatingBall.vue 去 shadow-lg) ─── 与 11.2/11.3 同文件，合并执行
11.1 (StreamLoading.vue 复制) ─── 独立
11.2 (isStreaming 追踪) ─┐
                         ├── 同文件，合并执行
11.3 (模板切换)         ─┘
main.ts 清理 ─── 与 11.2 关联（registerEvent 移入组件）
```

---

## 任务 10.1：关闭 macOS 窗口投影

**文件**：`app/work/src/main/window/floating-ball.window.ts`，第 12-26 行

在 `options` 中添加 `hasShadow: false`：

```typescript
const option: WindowMetadata = {
  options: {
    height: 60,
    width: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,       // 关闭 macOS 原生窗口投影
    type: "panel",
    // ... 其余不变
  },
  // ...
};
```

---

## 任务 10.2 + 11.2 + 11.3：FloatingBall.vue 重构

这三个任务修改同一个文件，合并为一次编辑。

**文件**：`app/work/src/renderer-floating-ball/FloatingBall.vue`

**完整目标代码**：

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import StreamLoading from "./StreamLoading.vue";

const isStreaming = ref(false);

function handleEvent(eventName: string, data: any) {
  if (eventName === "UPDATE_MESSAGE") {
    const eventType = data?.event?.type;
    if (eventType === "agent_start") {
      isStreaming.value = true;
    } else if (eventType === "agent_end") {
      isStreaming.value = false;
    }
  }
}

onMounted(() => {
  console.log("[Renderer UI] FloatingBall component mounted");
  // 接入主进程事件通知系统，追踪 AI 流式输出状态
  window.electronAPI.registerEvent({}, handleEvent);
});

function onClick() {
  console.log("[Renderer UI] FloatingBall clicked, showing main window");
  window.electronAPI.showMainWindow();
}

function onContextMenu(e: MouseEvent) {
  console.log("[Renderer UI] FloatingBall context menu triggered");
  e.preventDefault();
  window.electronAPI.showFloatingBallMenu();
}
</script>

<template>
  <div
    class="floating-ball-container flex h-screen w-screen items-center justify-center bg-transparent overflow-hidden"
  >
    <div
      class="ball flex h-[50px] w-[50px] cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95"
      style="-webkit-app-region: drag; filter: drop-shadow(0 4px 6px rgb(0 0 0 / 0.15));"
    >
      <div
        class="flex h-full w-full items-center justify-center rounded-full"
        style="-webkit-app-region: no-drag"
        @click.left="onClick"
        @contextmenu="onContextMenu"
      >
        <StreamLoading v-if="isStreaming" />
        <span v-else class="text-lg font-bold" style="pointer-events: none;">W</span>
      </div>
    </div>
  </div>
</template>
```

**变更点详解**：

| 位置 | 改前 | 改后 |
|------|------|------|
| import | `import { onMounted } from "vue"` | `import { onMounted, ref } from "vue"` + `import StreamLoading from "./StreamLoading.vue"` |
| `<script>` 顶部 | 无 | `const isStreaming = ref(false)` + `handleEvent` 函数 |
| `onMounted` | 仅 console.log | console.log + `window.electronAPI.registerEvent({}, handleEvent)` |
| ball div class | `shadow-lg` | 移除 `shadow-lg` |
| ball div style | `-webkit-app-region: drag` | 追加 `filter: drop-shadow(0 4px 6px rgb(0 0 0 / 0.15))` |
| 中心内容 | 固定 `<span>W</span>` | `<StreamLoading v-if="isStreaming" />` / `<span v-else>W</span>` |

`drop-shadow` 替代 `shadow-lg` 的原因：`filter: drop-shadow` 跟随元素的实际形状（圆形），而 `box-shadow` 在透明窗口上会在矩形边界产生可见的灰白边缘。

---

## 任务 11.1：复制 StreamLoading.vue

**文件**：`app/work/src/renderer-floating-ball/StreamLoading.vue`（新建）

从 `packages/ui/src/components/StreamLoading.vue` 复制代码，**仅修改一处**：

```diff
- <div class="relative flex aspect-square w-6 items-center justify-center">
+ <div class="relative flex aspect-square w-8 items-center justify-center">
```

`w-6`（24px）→ `w-8`（32px），适配 50x50 dp 球体，留 9px 内边距。

其余代码完全不变（SVG viewBox 为 `0 0 100 100` 是相对坐标系，不受容器尺寸影响，自动缩放）。

---

## main.ts 清理

**文件**：`app/work/src/renderer-floating-ball/main.ts`

移除 `registerEvent` 调用（已移入 `FloatingBall.vue` 组件内）：

```typescript
import { createApp } from "vue";
import FloatingBall from "./FloatingBall.vue";
import "./style.css";

createApp(FloatingBall).mount("#app");
```

---

## 验证

### 12.1 + 12.2：lint + build

```bash
pnpm lint && pnpm build
```

预期：0 warnings, 0 errors，全部 workspace 构建通过。

### 12.3：手动验证 — 视觉效果

`pnpm dev` 启动后开启悬浮球：
- 悬浮球为完美圆形，边缘无白色/灰色边界
- 球体有轻微投影（`drop-shadow`），视觉深度自然

### 12.4：手动验证 — AI 输出动画

- 在聊天页面发送消息触发 AI 响应
- AI 输出期间悬浮球中心的 "W" 替换为 StreamLoading 螺旋动画
- AI 输出结束后动画消失，恢复 "W" 字母
- 无对话时悬浮球始终显示 "W"

### 12.5：手动验证 — 基础功能回归

- 左键点击悬浮球 → 主窗口显示并聚焦
- 右键点击悬浮球 → 弹出菜单
- 拖拽移动 → 位置保存

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `floating-ball.window.ts` | **修改**：options 添加 `hasShadow: false` |
| `FloatingBall.vue` | **修改**：去 shadow-lg、加 isStreaming、模板切换、registerEvent 移入 |
| `StreamLoading.vue` | **新建**：从 packages/ui 复制，w-6 → w-8 |
| `main.ts` | **修改**：移除顶层 registerEvent 调用 |
