# 任务列表

## 1. 实现激活事件的拦截逻辑

- [ ] 在 [app.module.ts](file:///Users/liujinglun/code/willow/app/work/src/main/app.module.ts) 中：
  - 导入 `screen` 模块。
  - 新增 `isMouseOverFloatingBall()` 私有方法，判断鼠标光标是否在悬浮球边界内。
  - 修改 `onActivate()` 逻辑，在执行 `showMainWindow()` 之前调用 `isMouseOverFloatingBall()` 进行判定，如果为 `true` 则提前返回。

## 2. 验证与构建

- [ ] 运行 `pnpm lint` 进行语法和风格规范校验。
- [ ] 运行 `pnpm build` 进行打包编译校验。
- [ ] 运行 `pnpm dev` 启动开发应用并手动完成以下交互验证：
  - **拖拽移动验证**：当主窗口最小化或处于后台时，用鼠标拖动悬浮球，验证主窗口是否仍保持隐藏/最小化，没有被意外唤醒。
  - **右键验证**：当主窗口最小化或处于后台时，右键点击悬浮球，弹出右键菜单，验证主窗口是否仍保持隐藏/最小化。
  - **点击唤起验证**：左键单击悬浮球（不拖拽），验证主窗口是否能被正常唤起至前台。
  - **Dock 栏唤起验证**：点击 macOS Dock 栏上的应用图标，验证主窗口是否能被正常唤起至前台。
