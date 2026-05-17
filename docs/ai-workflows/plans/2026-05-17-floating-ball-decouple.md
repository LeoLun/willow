# 悬浮球渲染层独立拆分 + 通知系统接入 — 执行计划

## 依赖关系

```
9.1 (创建文件) ──┐
                ├──→ 9.3 (forge配置) ──→ 10.1/10.2 (lint/build)
9.2 (Vite配置) ─┘
9.4 (window.ts) ─── 独立，可与上面并行
9.5 (清理router) ── 独立，可与上面并行
9.6 (删除旧目录) ── 依赖 9.1 完成（文件已迁移）
9.7 (registerEvent) ─ 包含在 9.1 的 main.ts 中
```

## 任务 9.1：创建独立渲染器目录及文件

### 9.1a — `app/work/src/renderer-floating-ball/index.html`

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Willow</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

注：挂载点为 `#app`（非主应用的 `#root`），避免与主应用样式冲突。

### 9.1b — `app/work/src/renderer-floating-ball/FloatingBall.vue`

从 `src/renderer/src/floating-ball/FloatingBall.vue` 迁移，仅修改 CSS 选择器：

- `:global(#root)` → `:global(#app)`（匹配新 HTML 的挂载点）
- 其余代码完全不变

### 9.1c — `app/work/src/renderer-floating-ball/style.css`

```css
@import "tailwindcss";
@import "../../packages/shadcn/src/style.css";

body {
  margin: 0;
  overflow: hidden;
  background-color: transparent;
}
```

- 导入 tailwind 和 shadcn 主题变量
- 设置 body 透明、无滚动条（原在 FloatingBall.vue 中的全局样式移到这里）

### 9.1d — `app/work/src/renderer-floating-ball/main.ts`

```typescript
import { createApp } from "vue";
import FloatingBall from "./FloatingBall.vue";
import "./style.css";

// 接入主进程事件通知系统
window.electronAPI.registerEvent({}, (_event: string, _data: unknown) => {
  // 悬浮球已接入事件总线，未来可在此处理特定事件
});

createApp(FloatingBall).mount("#app");
```

- 无 Pinia、无 Vue Router、无 App.vue
- `registerEvent` 顶层调用，确保仅执行一次
- 回调为占位，后续可按需处理 `UPDATE_MESSAGE`、`SESSION_TITLE_UPDATED` 等事件

### 9.1e — 更新 FloatingBall.vue 中不再需要的全局样式

原组件中 `<style scoped>` 内的 `:global(body)` 和 `:global(#root)` 样式移至 `style.css`，组件中删除 `<style scoped>` 块（或简化为空）。

---

## 任务 9.2：创建独立 Vite 配置

**文件**：`app/work/vite.floating-ball.config.ts`

```typescript
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname + "/src/renderer-floating-ball",
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  plugins: [tailwindcss(), vue()],
});
```

- `root` 指向新目录，Vite 从该目录查找 `index.html` 和扫描源文件
- 仅 `vue()` 和 `tailwindcss()` 两个插件，无需 optimizer、resolve aliases 等主应用配置
- 无需 `@shared` 别名（悬浮球不引用 shared 模块，IPC 调用通过 `window.electronAPI` 运行时桥接）

---

## 任务 9.3：更新 forge.config.mjs

**文件**：`app/work/forge.config.mjs`，第 108-111 行

```js
// 修改前
{
  name: "floating_ball",
  config: "vite.renderer.config.ts",
}

// 修改后
{
  name: "floating_ball",
  config: "vite.floating-ball.config.ts",
}
```

Electron Forge Vite 插件将自动为 `floating_ball` 注入全局变量：
- `FLOATING_BALL_VITE_DEV_SERVER_URL`
- `FLOATING_BALL_VITE_NAME`
- `FLOATING_BALL_VITE_PUBLIC_DIR`

---

## 任务 9.4：更新 floating-ball.window.ts

**文件**：`app/work/src/main/window/floating-ball.window.ts`

**修改点 1**（第 29-36 行）：加载路径变量替换

```typescript
// 修改前
if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  option.loadURL = `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/floating-ball`;
} else {
  option.loadFile = join(
    __dirname,
    `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
  );
}

// 修改后
if (FLOATING_BALL_VITE_DEV_SERVER_URL) {
  option.loadURL = FLOATING_BALL_VITE_DEV_SERVER_URL;
} else {
  option.loadFile = join(
    __dirname,
    `../renderer/${FLOATING_BALL_VITE_NAME}/index.html`,
  );
}
```

注意：
- 不再拼接 `/floating-ball` 路径（独立渲染器始终显示悬浮球，无需路由导航）
- `FLOATING_BALL_VITE_DEV_SERVER_URL` 已指向独立 dev server 根路径
- `FLOATING_BALL_VITE_NAME` 对应独立构建输出目录

---

## 任务 9.5：清理主渲染器 router.ts

**文件**：`app/work/src/renderer/src/router.ts`

**删除项 1**（第 3 行）：移除 FloatingBall 组件导入

```typescript
// 删除这行
import FloatingBall from "./floating-ball/FloatingBall.vue";
```

**删除项 2**（第 49 行）：移除 `/floating-ball` 路由

```typescript
// 删除这行
{ path: "/floating-ball", name: "floatingBall", component: FloatingBall },
```

**删除项 3**（第 57-61 行）：移除 `beforeEach` 中的悬浮球导航守卫

```typescript
// 删除这段
router.beforeEach(async (to) => {
  // [!删除开始]
  const url = new URL(window.location.href);
  if (url.searchParams.get("route") === "/floating-ball" && to.path !== "/floating-ball") {
    return { path: "/floating-ball" };
  }
  // [!删除结束]

  if (to.path === "/" && !to.query.workspaceId) {
    // ... 保留 workspace 守卫
  }
});
```

`FloatingBallSetting` 导入和路由保持不变（设置页面仍需要）。

---

## 任务 9.6：删除旧悬浮球目录

```bash
rm -rf app/work/src/renderer/src/floating-ball/
```

确认目录已删除且不影响编译。

---

## 任务 10：验证

### 10.1 Lint

```bash
pnpm lint
```

预期：0 warnings, 0 errors。

### 10.2 Build

```bash
pnpm build
```

预期：全部 8 个 workspace 构建成功，包括 `floating_ball` renderer。

### 10.3 手动测试

`pnpm dev` 启动后：

1. 设置页面开启悬浮球 → 悬浮球出现在屏幕右下角
2. 左键点击悬浮球 → 主窗口显示并聚焦
3. 右键点击悬浮球 → 弹出菜单（显示主窗口 / 退出登录 / 退出 Willow）
4. 拖拽悬浮球到新位置 → 松手后位置保存
5. 重启应用 → 悬浮球恢复到上次位置
6. 关闭开关 → 悬浮球销毁

### 10.4 主应用回归

- 设置页面（外观、配置、悬浮球开关）正常显示和操作
- 聊天功能正常
- 自动化功能正常
- 技能管理正常

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/renderer-floating-ball/index.html` | **新建** |
| `src/renderer-floating-ball/main.ts` | **新建** |
| `src/renderer-floating-ball/FloatingBall.vue` | **新建**（从旧目录迁移，微调 CSS 选择器） |
| `src/renderer-floating-ball/style.css` | **新建** |
| `vite.floating-ball.config.ts` | **新建** |
| `forge.config.mjs` | **修改**（第 108-111 行） |
| `floating-ball.window.ts` | **修改**（第 29-36 行） |
| `router.ts` | **修改**（删除 3 处） |
| `src/renderer/src/floating-ball/FloatingBall.vue` | **删除** |
