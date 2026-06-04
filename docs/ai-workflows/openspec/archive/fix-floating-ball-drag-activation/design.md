# 设计方案：拦截悬浮球拖拽引起的激活事件

## 交互行为与问题分析

在 macOS 下，即使悬浮球窗口被设置为 `focusable: false`，当用户点击或拖拽悬浮球时，操作系统仍会将该窗口所属的应用置为 active 状态，并触发 Electron 上的 `app.on('activate')` 事件。

目前主进程的代码中，一旦接收到 `activate` 事件，会无条件执行 `showMainWindow()`：

```typescript
@On("activate")
async onActivate() {
  if (!this.initSucceeded) {
    await this.bootstrapApplication();
    return;
  }

  this.showMainWindow();
}
```

这会导致在拖拽悬浮球或右键呼出悬浮球菜单时，主窗口也被强制显示出来。

## 设计细节

为了区分是“用户点击 Dock 栏/Cmd+Tab 显式激活应用”还是“用户仅与悬浮球交互引起的激活”，我们可以在 `onActivate` 触发时，检查当前的鼠标位置是否位于悬浮球窗口的 bounds 范围内。

1. **获取鼠标坐标**：使用 Electron 提供的 `screen.getCursorScreenPoint()` API 获取当前的屏幕鼠标位置。
2. **获取悬浮球窗口的 bounds**：通过 `FloatingBallWindow.getInstance()` 获取悬浮球窗口实例，如果实例存在且可见，获取其边界 `win.getBounds()`。
3. **坐标判定**：如果鼠标位置位于悬浮球 bounds 范围内，说明此次激活是由用户与悬浮球交互触发的，因此直接 `return` 拦截，不再展示主窗口。

### 详细代码结构

在 [app.module.ts](file:///Users/liujinglun/code/willow/app/work/src/main/app.module.ts) 中：

1. 从 `electron` 导入 `screen`：
   ```typescript
   import { app, dialog as electronDialog, screen } from "electron";
   ```
2. 新增私有方法 `isMouseOverFloatingBall`：
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
3. 修改 `onActivate` 函数：
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
