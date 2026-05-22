# 悬浮球功能

## 动机

当前 Willow 应用只有主窗口一种交互方式。用户关闭主窗口后，应用退到后台，缺乏快速唤起主窗口的入口。悬浮球（类似微信/QQ 的桌面悬浮球）提供常驻桌面的快捷入口，提升用户体验。

## 目标

1. 设置页面新增"悬浮球"导航栏，进入后可开启/关闭悬浮球，默认为关闭
2. 新增独立悬浮球窗口，默认出现在屏幕右下角，始终置顶
3. 悬浮球交互：左键点击 → 打开/激活主窗口；右键点击 → 弹出菜单（含退出登录等操作）
4. 支持鼠标拖拽移动悬浮球位置，位置持久化记忆
5. macOS 下悬浮球跨所有桌面（Spaces）显示，切换桌面时不消失

## 范围

- 新增 `FloatingBallWindow`（独立 BrowserWindow，无边框、置顶、小尺寸）
- 新增悬浮球独立渲染器（独立目录、独立 Vite配置、独立 Vue 应用入口，与主渲染器彻底解耦）
- 设置页面新增"悬浮球"侧边栏导航及对应路由页面
- 新增 IPC 通道：获取/设置悬浮球开关状态、焦点/唤起主窗口、重置窗口大小与焦点（`RESIZE_FLOATING_BALL_WINDOW`）
- 持久化悬浮球开关状态与位置（JSON 文件）
- 右键菜单（Electron Menu API），包含"显示主窗口"和"退出登录"
- macOS 跨桌面显示（`setVisibleOnAllWorkspaces`），全屏空间也保持可见
- 提升置顶层級为 `status` 级别（`setAlwaysOnTop(true, 'status')`），确保悬浮球在 Dock 和菜单栏之上
- 悬浮球渲染层独立拆分，不加载主应用的 Pinia/Router/App.vue 等基础设施
- 接入 LUI（Language User Interface）面板：在流式输出、工具审批或提问交互时，自动展开为精致的悬浮毛玻璃卡片
- 支持展示最近一层的流式输出，包括 AI 思考（Thinking）、工具调用中（Tool Execution）、内容流式输出（Text Stream）
- 支持集成 `@willow/ui` 的 `PermissionApprovalPanel` 和 `AskUserPanel` 进行权限审批和自定义或选项答复，并自动控制窗口 Focusable 焦点状态

## 非范围

- 不改变现有主窗口和 AI 助手功能
- 不改变底层 AI 消息和工具调度逻辑
- 不影响自动化系统

