# 悬浮球设计

## 方案选择

采用 **方案 A：独立 BrowserWindow + 专用 Vite renderer**。

与其他方案的对比：

| 方案 | 描述 | 结论 |
|------|------|------|
| A：独立 BrowserWindow + Vite renderer | 新增 FloatingBallWindow，独立 Vite renderer 条目 | **推荐**，与现有架构一致，支持 Vue 组件体系，可扩展 |
| B：独立 BrowserWindow + data URL | 不需要新 Vite 条目，直接用 HTML 字符串 | 无法使用 Vue/shadcn，不利于后续扩展 |
| C：WebContentsView 内嵌主窗口 | 复用现有 AiAppViewService 模式 | 悬浮球会随主窗口关闭而消失，不符合"常驻桌面"需求 |

## 窗口架构

### FloatingBallWindow

```
app/work/src/main/window/floating-ball.window.ts
```

- 类型：无边框（`frame: false`）、小尺寸圆形（约 60x60 dp）
- 置顶：`alwaysOnTop: true`，窗口创建后在 `onInit()` 中通过 `setAlwaysOnTop(true, 'status')` 提升为 `status` 级别，确保悬浮球在 Dock 和菜单栏之上。调用包裹在 try-catch 中，失败不影响应用启动
- 跨桌面：在 `onInit()` 中通过 `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` 实现 macOS 下跨所有桌面（Spaces）显示，全屏空间也保持可见。带有 `process.platform === 'darwin'` 平台判断。失败不影响应用启动
- 透明背景，非矩形区域通过 CSS `border-radius: 50%` + Electron 透明窗口实现
- `skipTaskbar: true` — 不在任务栏显示
- `resizable: false`
- Dev 环境加载 Vite dev server URL，生产环境加载构建产物
- 拖拽移动通过 CSS `-webkit-app-region: drag` 实现，内部按钮区域设 `no-drag`

### Forge 配置变更

在 `forge.config.mjs` 的 `renderer` 数组中新增一条，使用独立的 Vite 配置：

```js
renderer: [
  { name: "main_window", config: "vite.renderer.config.ts" },
  { name: "floating_ball", config: "vite.floating-ball.config.ts" },
],
```

`floating_ball` 使用独立的 `vite.floating-ball.config.ts`，不再复用主窗口的 Vite 配置。Electron Forge Vite 插件会根据 name 自动注入对应的全局变量：
- `FLOATING_BALL_VITE_DEV_SERVER_URL` — 开发模式 dev server 地址
- `FLOATING_BALL_VITE_NAME` — 生产模式构建输出目录名
- `FLOATING_BALL_VITE_PUBLIC_DIR` — public 目录路径

### 悬浮球独立渲染器

悬浮球采用完全独立的渲染器，与主窗口渲染器彻底解耦。

**目录结构**：
```
app/work/src/renderer-floating-ball/
  index.html          # 独立 HTML 入口
  main.ts             # 最小 Vue 应用入口：createApp(FloatingBall).mount('#app')
  FloatingBall.vue    # 悬浮球组件（从 src/renderer/src/floating-ball/ 迁入）
  style.css           # 最小样式：tailwind + shadcn 主题变量
```

**Vite 配置**（`vite.floating-ball.config.ts`）：
```ts
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname + "/src/renderer-floating-ball",
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  plugins: [tailwindcss(), vue()],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
});
```

- `root` 指向新目录，确保 Vite 扫描该目录下的源文件
- 仅包含 `vue()` 和 `tailwindcss()` 两个必要插件
- 无需 `@willow/shadcn`、`@willow/ui`、`@willow/sender` 别名，悬浮球不引用这些包

**Vue 应用入口**（`main.ts`）：
```ts
import { createApp } from "vue";
import FloatingBall from "./FloatingBall.vue";
import "./style.css";

createApp(FloatingBall).mount("#app");
```

- 无 Pinia、无 Vue Router、无 App.vue 布局壳
- 直接将 `FloatingBall.vue` 挂载到 `#app`

**HTML 入口**（`index.html`）：
```html
<!doctype html>
<html>
  <head><meta charset="UTF-8" /><title>Willow</title></head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

**样式**（`style.css`）：
```css
@import "tailwindcss";
@import "../../packages/shadcn/src/style.css";
```
导入 tailwind 和 shadcn 主题变量，维持 `bg-primary`/`text-primary-foreground` 等类名可用。

### FloatingBallWindow 加载路径变更

`floating-ball.window.ts` 使用 `FLOATING_BALL_VITE_*` 变量替代 `MAIN_WINDOW_VITE_*`：

```typescript
// 开发环境：加载独立 dev server
if (FLOATING_BALL_VITE_DEV_SERVER_URL) {
  option.loadURL = FLOATING_BALL_VITE_DEV_SERVER_URL;
}
// 生产环境：加载独立构建产物
else {
  option.loadFile = join(
    __dirname,
    `../renderer/${FLOATING_BALL_VITE_NAME}/index.html`,
  );
}
```

不再需要 `?route=/floating-ball` 查询参数，因为独立渲染器始终显示悬浮球。

### 悬浮球接入通知系统

悬浮球需要与主应用共用同一套事件通知系统，以便未来展示 Agent 运行状态、未读消息提示等。

**事件推送流程**：
```
主进程 Service.sendEvent(event, data)
  → EventService (RxJS Subject)
    → webContents.send(EVENT_BUS, payload) → 所有已注册的窗口
      → 悬浮球 preload: ipcRenderer.on(EVENT_BUS, ...) → callback(event, data)
```

**接入方式**：悬浮球渲染器沿用现有 preload 提供的 `registerEvent` API，无需修改主进程代码。

**`main.ts` 中注册**（顶层调用，确保仅执行一次）：
```typescript
// 接入主进程事件通知系统
window.electronAPI.registerEvent({}, (event: string, data: any) => {
  // 事件回调，未来可在此处理特定事件
  // 可用事件：UPDATE_MESSAGE, SESSION_TITLE_UPDATED, TODO_UPDATED, CONTEXT_COMPRESSION_UPDATED
});
```

- `registerEvent` 是异步 IPC invoke，内部调用 `REGISTER_EVENT` 通道
- 主进程 `EventController` 自动从 `_event.sender` 获取悬浮球的 webContents 并注册到 `EventService`
- `callback` 参数触发 `onEventBus` 设置 `ipcRenderer.on(EVENT_BUS, ...)` 持久监听
- 无需在渲染器侧实现 `useEventBus` 的完整封装（如 `ensureRegistered` 单例、`addEventListener`/`removeEventListener`），悬浮球仅需一个顶层回调
- 当悬浮球窗口销毁时，`EventService` 中的 RxJS 订阅自动清理

### 悬浮球视觉效果修复

**问题**：悬浮球显示不圆，存在白色边界。

**根因**：
1. `shadow-lg`（`box-shadow`）在 Electron 透明窗口上渲染为可见的灰白边缘
2. macOS 对透明窗口默认添加投影

**修复**：
1. `floating-ball.window.ts` 的 BrowserWindow options 中新增 `hasShadow: false`，关闭 macOS 原生窗口投影
2. `FloatingBall.vue` 中移除 `shadow-lg`，如需视觉深度使用 `filter: drop-shadow(0 4px 6px rgb(0 0 0 / 0.15))`
3. 确保 `body` 和 `#app` 背景为 `transparent`（已在 style.css 中配置）

### AI 流式输出动画

悬浮球集成 AI 输出状态指示，流式输出时球体中心展示动画。

**StreamLoading.vue**：从 `packages/ui/src/components/StreamLoading.vue` 复制到 `src/renderer-floating-ball/StreamLoading.vue`。
- SVG 六瓣螺旋粒子动画，`requestAnimationFrame` 驱动
- 尺寸从原 `w-6`（24px）适配到 `w-8`（32px），适配 50x50 dp 球体
- 保持原组件的所有动画参数（粒子数量、拖尾、旋转、脉冲）

**isStreaming 状态追踪**：在 `FloatingBall.vue` 中监听 `UPDATE_MESSAGE` 事件：
```typescript
const isStreaming = ref(false);

function handleEvent(eventName: string, data: any) {
  if (eventName === "UPDATE_MESSAGE") {
    const eventType = data?.event?.type;
    if (eventType === "agent_start") isStreaming.value = true;
    if (eventType === "agent_end") isStreaming.value = false;
  }
}

onMounted(() => {
  window.electronAPI.registerEvent({}, handleEvent);
});
```

**模板切换**：
```html
<StreamLoading v-if="isStreaming" />
<span v-else class="text-lg font-bold">W</span>
```

注意：`registerEvent` 调用从 `main.ts` 移至 `FloatingBall.vue` 的 `onMounted` 中，以便组件直接获取事件更新状态。原 `main.ts` 中的顶层调用移除（避免重复注册）。

### 主渲染器清理

`router.ts` 中移除：
- `/floating-ball` 路由和 `FloatingBall.vue` 组件导入
- `beforeEach` 中 `?route=/floating-ball` 的导航守卫

`src/renderer/src/floating-ball/` 目录整体删除。

### 主窗口通信

悬浮球需要与主窗口协调：
- 左键点击 → 通过 IPC 通知主进程显示/聚焦主窗口
- 主窗口已有 `MainWindow` 实例，通过 `WindowFactoryResolver` 获取并调用 `show()`/`focus()`

## 持久化

### electron-store

引入 `electron-store` 存储悬浮球配置：

```ts
interface FloatingBallStore {
  enabled: boolean;          // 默认 false
  x: number;                  // 上次位置 x（屏幕坐标）
  y: number;                  // 上次位置 y（屏幕坐标）
}
```

- 在 `FloatingBallService` 中封装读写
- 窗口移动时通过 IPC 通知主进程更新位置（debounce 300ms）
- 开关控制由设置页面通过 IPC 写入

备选：若不想新增依赖，可使用 `app.getPath('userData')` + JSON 文件手动管理。

## 交互设计

### 左键单击 → 显示主窗口

1. 悬浮球 renderer 通过 IPC 调用 `SHOW_MAIN_WINDOW`
2. 主进程通过 `WindowFactoryResolver` 获取 `MainWindow` 实例
3. 若主窗口已最小化 → 恢复；若已存在但被遮挡 → 聚焦并置前；若不存在 → 重新创建

### 右键菜单

使用 Electron 原生的 `Menu.buildFromTemplate()` + `popup()`：

- "关闭悬浮球" → 关闭悬浮球窗口，并将 enabled 写为 false
- "显示主窗口" → 同上逻辑
- "退出登录" → 清除 DeepSeek API Key + 关闭悬浮球
- —— 分隔线 ——
- "退出 Willow" → `app.quit()`

右键事件在 preload 中处理，通过 IPC 通知主进程弹出 menu。菜单需要绑定到悬浮球窗口，且弹出菜单本身不得触发主窗口 `show()`；只有选择"显示主窗口"菜单项时才调用主窗口唤起逻辑。

### 拖拽移动

- 悬浮球窗口整体设为 `-webkit-app-region: drag`
- 拖拽开始时记录起始位置
- `will-move` / `move` 事件中更新位置存储（debounce）
- 屏幕边界吸附：移动结束时，若位置超出屏幕边界，贴边吸附

## 渲染器

### 新路由页面

`app/work/src/renderer/src/pages/setting/floating-ball/FloatingBallSetting.vue`

- 一个 Switch/Toggle 开关，控制悬浮球启用/禁用
- 说明文字："开启后，桌面将显示悬浮球快捷入口"

### 悬浮球页面组件

`app/work/src/renderer/src/floating-ball/FloatingBall.vue`

- 圆形按钮，内显示 Willow 图标或首字母
- 整体 `-webkit-app-region: drag`
- 左键 `click` 触发显示主窗口
- 右键 `contextmenu` 触发 IPC 弹出菜单

### 路由注册

在 `router.ts` 中新增 `/setting/floating-ball` 路由，以及在 Setting.vue 侧边栏中新增"悬浮球"导航项。

## 数据流

```
设置页面 Toggle Switch
  → IPC SET_FLOATING_BALL_ENABLED { enabled: true/false }
  → FloatingBallService.setEnabled(enabled)
    → electron-store 写入
    → 创建/销毁 FloatingBallWindow

悬浮球左键点击
  → IPC SHOW_MAIN_WINDOW
  → FloatingBallService.showMainWindow()
    → WindowFactoryResolver → MainWindow.show()/focus()

悬浮球右键
  → 主进程 show context menu
  → 选择菜单项 → 对应操作

悬浮球拖拽
  → BrowserWindow 'move' 事件
  → FloatingBallService.updatePosition(x, y)
    → electron-store 写入（debounce）
```

## 生命周期

- 应用启动时：`AppModule.onReady` 中检查 `enabled`，若为 true 则创建悬浮球窗口
- 设置关闭时：销毁悬浮球窗口
- 主窗口关闭时：悬浮球保持（macOS 行为）
- 应用退出时：通过 `On("before-quit")` 保存位置并销毁窗口

## 验证

- 设置页面 Toggle 开启/关闭悬浮球
- 悬浮球出现在屏幕右下角
- 拖拽悬浮球到新位置，重启后位置保持
- 左键点击悬浮球 → 主窗口显示并聚焦
- 右键点击悬浮球 → 弹出菜单
- 右键点击悬浮球 → 仅弹出菜单，不唤起已 hide 的主窗口
- 右键菜单选择"关闭悬浮球" → 悬浮球关闭，设置开关状态持久化为关闭
- 关闭悬浮球开关 → 悬浮球销毁
- 运行 `pnpm lint` 和 `pnpm build` 通过
