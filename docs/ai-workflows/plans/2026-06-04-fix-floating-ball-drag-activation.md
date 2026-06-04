# 执行计划：修复拖拽悬浮球导致主窗口意外展示的问题

该计划旨在解决在 macOS 操作系统下，由于拖动或右击悬浮球窗口触发应用的 `activate` 事件，从而导致主窗口被意外展示和聚焦的问题。

## 依赖与前提条件

- 无

## 详细执行步骤

### 步骤 1：修改 `app.module.ts` 导入 `screen` 模块

- 修改文件：[app.module.ts](file:///Users/liujinglun/code/willow/app/work/src/main/app.module.ts)
- 从 `electron` 模块中导入 `screen`：
  ```typescript
  import { app, dialog as electronDialog, screen } from "electron";
  ```

### 步骤 2：在 `AppModule` 中添加 `isMouseOverFloatingBall` 私有方法

- 在 [app.module.ts](file:///Users/liujinglun/code/willow/app/work/src/main/app.module.ts) 类定义中添加方法，判断当前鼠标光标是否在悬浮球窗口 bounds 范围内：
  ```typescript
  private isMouseOverFloatingBall(): boolean {
    const instance = FloatingBallWindow.getInstance();
    if (instance) {
      const win = instance.BrowserWindow;
      if (win && !win.isDestroyed() && win.isVisible()) {
        const mousePoint = screen.getCursorScreenPoint();
        const bounds = win.getBounds();
        return (
          mousePoint.x >= bounds.x &&
          mousePoint.x <= bounds.x + bounds.width &&
          mousePoint.y >= bounds.y &&
          mousePoint.y <= bounds.y + bounds.height
        );
      }
    }
    return false;
  }
  ```

### 步骤 3：在 `onActivate` 事件监听器中进行拦截

- 修改 `app.module.ts` 的 `onActivate` 函数，如果 `isMouseOverFloatingBall()` 返回 `true`，则提前返回：
  ```typescript
  @On("activate")
  async onActivate() {
    if (!this.initSucceeded) {
      await this.bootstrapApplication();
      return;
    }

    if (this.isMouseOverFloatingBall()) {
      return;
    }

    this.showMainWindow();
  }
  ```

## 验证计划

1. **规范检查**：
   - 运行 `pnpm lint` 验证无代码规范和类型报错。
2. **构建验证**：
   - 运行 `pnpm build` 确认项目可以正常完成构建。
3. **功能验证**：
   - 运行 `pnpm dev` 启动 Electron 应用。
   - 使主窗口置于后台或将其最小化。
   - **拖拽移动验证**：鼠标按住悬浮球进行拖拽移动，验证主窗口是否仍保持隐藏/最小化，没有被意外唤起。
   - **右键验证**：右击悬浮球，弹出右键上下文菜单，验证主窗口是否仍保持隐藏/最小化。
   - **点击唤起验证**：左键单击悬浮球，主窗口应正常唤起并聚焦到前台。
   - **Dock 栏激活验证**：点击 Dock 栏应用图标，主窗口应正常唤起并聚焦到前台。
