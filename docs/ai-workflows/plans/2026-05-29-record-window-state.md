# 执行计划：记录并恢复主窗口的位置和大小

## 概述

为了防止每次打开应用时主窗口的大小和位置都被重置，本计划将对主窗口的初始化配置和关闭/调整状态进行持久化处理。计划包含两个执行分片（Slices），Slice 2 依赖于 Slice 1。

---

## Slice 1: 支持持久化并恢复主窗口状态

### 1.1 修改 `main.window.ts`
**文件**: `app/work/src/main/window/main.window.ts`
- **读取持久化状态**：
  - 在文件头部导入 `node:fs` 中的 `existsSync` 和 `readFileSync`，以及 `node:path` 中的 `join`。
  - 定义 `window-state.json` 路径为 `join(app.getPath("userData"), "window-state.json")`。
  - 读取并解析文件中的 `width`、`height`、`x` 和 `y`，动态合并入 `WindowMetadata` 的 `options` 属性中（仅当文件存在且解析成功时应用，否则使用默认的 1200x800 居中）。
- **监听窗口变化事件**：
  - 在 `MainWindow` 类中添加 `@On("resize")` 和 `@On("move")` 装饰器修饰的监听函数。
  - 实现带有 500ms 防抖的保存状态方法 `saveState`。
  - 在 `saveState` 中，获取窗口当前的 `isMaximized` 状态。
  - 如果未最大化，通过 `this.win.getBounds()` 获取 `x, y, width, height` 并写入 `window-state.json`。
  - 如果已最大化，则更新 `isMaximized: true`，但保留原有的 `x, y, width, height` 以免丢失正常状态下的窗口大小位置。
- **恢复最大化状态**：
  - 在 `onInit()` 钩子中，从 `window-state.json` 中读取 `isMaximized` 字段，若为 `true` 则调用 `this.win.maximize()` 恢复最大化。

---

## Slice 2: 验证与清理

### 2.1 代码规范校验与编译测试
- 在工作空间根目录下运行：
  ```bash
  pnpm lint
  pnpm build
  ```
  确保无 oxlint 报错或 TypeScript 编译错误。

### 2.2 手动验证
- 运行 `pnpm dev` 启动 Electron 桌面应用。
- 调整主窗口的位置和大小，等待 1 秒后关闭应用。
- 再次运行 `pnpm dev`，确认窗口正确恢复到上次关闭时的大小和位置。
- 最大化主窗口，关闭应用并重新启动，验证窗口以最大化状态展示。
- 从最大化状态还原后，检查窗口的大小和位置是否恢复到最大化前的数值。

---

## 文件变更清单

| 操作 | 文件 |
|------|------|
| 修改 | `app/work/src/main/window/main.window.ts` |
