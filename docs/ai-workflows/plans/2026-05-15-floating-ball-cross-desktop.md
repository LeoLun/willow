# 悬浮球 macOS 跨桌面支持 — 执行计划

## 变更范围

单文件改动：`app/work/src/main/window/floating-ball.window.ts`

## 任务 7.1：调用 `setVisibleOnAllWorkspaces`

**文件**：`app/work/src/main/window/floating-ball.window.ts`  
**位置**：`onInit()` 方法内，`FloatingBallWindow.instance = this` 之前

**改动**：新增一行：

```typescript
this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
```

**说明**：
- `setVisibleOnAllWorkspaces` 是 Electron 的 macOS 专属 API
- `true` 表示在所有 Spaces（虚拟桌面）上可见
- `{ visibleOnFullScreen: true }` 确保在全屏应用的 Space 中也保持可见
- Windows/Linux 上此调用无效果，无需平台判断

## 任务 7.2：提升 `setAlwaysOnTop` 层级为 `status`

**文件**：同上  
**位置**：`onInit()` 方法内，紧接着上一行

**改动**：新增一行：

```typescript
this.win.setAlwaysOnTop(true, 'status');
```

**说明**：
- 构造函数中已有 `alwaysOnTop: true`，但默认层级为 `'floating'`
- `'status'` 级别高于 `'floating'`，确保悬浮球在 Dock 和菜单栏之上
- 此 API 跨平台可用，但 `'status'` 级别在 macOS 上效果最明显

## 完整改动预览

`floating-ball.window.ts` 的 `onInit()` 方法：

```typescript
onInit() {
    console.log(
      "[Main Window] FloatingBallWindow onInit called. URL:",
      option.loadURL,
    );
    // 先将 instance 赋值，确保后续即使出错也能通过 getInstance() 获取实例
    FloatingBallWindow.instance = this;
    try {
      if (process.platform === "darwin") {
        this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      }
      this.win.setAlwaysOnTop(true, 'status');
    } catch (error) {
      console.error("[FloatingBallWindow] Failed to set window properties:", error);
    }
  }
```

**防御性设计要点**：
1. `FloatingBallWindow.instance = this` 前置，确保即便后续调用失败也能获取实例
2. `process.platform === "darwin"` 判断，`setVisibleOnAllWorkspaces` 仅 macOS 调用
3. try-catch 包裹，防止这两个可选调用失败导致整个应用启动中断（`onInit()` 抛错会阻止 `bootstrapApplication()` 中 `createWindow()` 的执行）

## 验证

1. **构建验证**：`pnpm lint && pnpm build` 通过
2. **手动测试 — 切换桌面**：macOS 下开启悬浮球，三指/四指滑动切换桌面，确认悬浮球在所有桌面上均可见
3. **手动测试 — 全屏应用**：进入全屏应用（如全屏浏览器），确认悬浮球仍然可见
4. **手动测试 — 基础功能回归**：左键点击唤起主窗口、右键弹出菜单、拖拽移动，功能正常

## 依赖

- 无新增依赖
- 基于已有的 `FloatingBallWindow` 实现
- Electron 版本需支持 `setVisibleOnAllWorkspaces`（Electron >= 4 均支持）
