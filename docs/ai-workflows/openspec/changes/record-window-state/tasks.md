# 任务列表

## 1. 记录与恢复主窗口状态
- [ ] 修改 `app/work/src/main/window/main.window.ts`：
  - 在文件头部引入 `node:fs` 中的 `existsSync`、`readFileSync`、`writeFileSync`，引入 `node:path` 中的 `join`。
  - 读取并解析 `app.getPath("userData")/window-state.json` 文件。
  - 将读取到的 `width`、`height`、`x`、`y` 混合到 `WindowMetadata` 的 `options` 中。
  - 在 `MainWindow` 类中添加 `resize` 与 `move` 的事件监听（通过 `@On("resize")` 和 `@On("move")`）。
  - 实现 `saveState` 方法，带 500ms 的防抖机制，保存当前的 `width`、`height`、`x`、`y` 以及 `isMaximized` 状态。
  - 在 `onInit` 中，如果上次状态是最大化（`isMaximized` 为 `true`），则调用 `this.win.maximize()` 恢复最大化。

## 2. 验证与清理
- [ ] 运行 `pnpm lint` 检查代码规范。
- [ ] 运行 `pnpm build` 确认编译正常。
- [ ] 启动应用（`pnpm dev`），调整窗口位置和大小、最大化，重启应用验证是否成功记录并恢复。
