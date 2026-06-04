# 提案：修复拖拽悬浮球导致主窗口意外展示的问题

## 动机

在 macOS 操作系统下，当应用处于后台或主窗口被最小化/隐藏时，如果用户拖拽或右击悬浮球，会触发 Electron 的 `activate` 事件。目前 `AppModule` 对 `activate` 事件的处理是直接调用 `showMainWindow()` 将主窗口置于前台，这就导致即使只是想拖动或右击悬浮球，也会意外地把主窗口拉到前台，影响用户体验。

## 目标

1. **拦截非预期的激活**：在 `app.module.ts` 中的 `activate` 事件监听器中，检查当前触发事件时鼠标指针是否落在悬浮球窗口范围内。
2. **避免自动展现主窗口**：若判定此次激活是由悬浮球交互（拖拽、右键等）引起的，则不调用 `showMainWindow()`，直接返回。
3. **保留正常点击唤起行为**：如果用户左键单击悬浮球，依然会通过 IPC 发送 `SHOW_MAIN_WINDOW` 并显式调用 `showMainWindow()`，此路径不应受影响。
4. **保留正常激活行为**：如果用户点击 macOS Dock 栏图标或通过 `Cmd+Tab` 激活应用，由于鼠标指针通常不在悬浮球上，因此仍会正常显示主窗口。

## 范围

- [app.module.ts](file:///Users/liujinglun/code/willow/app/work/src/main/app.module.ts) 的 `onActivate` 处理逻辑。

## 非范围

- 改变悬浮球窗口的 Electron 配置（如 `focusable`）或事件捕获逻辑。
- 改变悬浮球本身的前端拖拽或点击逻辑。
