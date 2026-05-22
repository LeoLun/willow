# 悬浮球功能规格

## 功能概述

桌面悬浮球是一个常驻桌面的快捷入口，用户可通过它快速唤起 Willow 主窗口。

## 需求

### REQ-FB-001: 设置页面悬浮球开关

- 设置页面左侧导航栏新增"悬浮球"选项
- 路由 `/setting/floating-ball`，对应组件 `FloatingBallSetting.vue`
- 页面包含一个 Toggle 开关和说明文字
- 默认状态为关闭
- 开关状态通过 IPC 同步到主进程

### REQ-FB-002: 悬浮球窗口

- 独立 BrowserWindow，无边框、圆形、约 60x60 dp
- `alwaysOnTop: true`，`skipTaskbar: true`
- 窗口创建后通过 `setAlwaysOnTop(true, 'status')` 提升至 `status` 级别，保持在 Dock 和菜单栏之上
- 通过 `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` 实现跨所有桌面（Spaces）显示，全屏空间也保持可见（macOS 专属，Windows/Linux 无效果）
- 透明背景，CSS `rounded-full` 裁切为圆形，窗口无投影（`hasShadow: false`）
- 不使用 `box-shadow`（如 `shadow-lg`），避免在透明窗口上产生白色边界；如需阴影效果使用 `filter: drop-shadow`
- 默认出现在屏幕右下角（`screen.workArea` 计算）
- 窗口不可调整大小
- 非激活时不抢焦点
- 加载独立悬浮球渲染器（非主应用渲染器），见 REQ-FB-008
- 悬浮球中心展示动态内容：AI 流式输出时显示加载动画，空闲时显示 "W" 字母，见 REQ-FB-010

### REQ-FB-003: 左键点击唤起主窗口

- 左键点击悬浮球 → IPC 通知主进程
- 主进程唤起 MainWindow：
  - 若窗口最小化 → 恢复
  - 若窗口存在但不可见 → 显示并聚焦
  - 若窗口不存在 → 创建新窗口

### REQ-FB-004: 右键菜单

- 右键点击悬浮球 → 弹出 Electron 原生上下文菜单
- 弹出右键菜单本身不得唤起、显示或聚焦主窗口；只有用户显式选择"显示主窗口"时才允许显示主窗口
- 菜单项：
  - "关闭悬浮球" — 关闭悬浮球窗口，并将悬浮球开关状态持久化为关闭
  - "显示主窗口" — 同上
  - "退出登录" — 清除 DeepSeek API Key，关闭悬浮球
  - —— 分隔线 ——
  - "退出 Willow" — `app.quit()`

### REQ-FB-005: 拖拽移动

- 悬浮球整体可拖拽
- 拖拽时通过 `will-move` 或 `move` 事件实时更新位置
- 移动结束后持久化位置（debounce 300ms 写入存储）
- 下次启动时恢复上次位置
- 若上次位置所在屏幕已不可用，回退到主屏幕右下角

### REQ-FB-006: 位置持久化

- 悬浮球位置（x, y）和启用状态（enabled）持久化存储
- 存储方案：electron-store 或 JSON 文件（`app.getPath('userData')/floating-ball.json`）
- 应用退出时保存当前状态

### REQ-FB-007: 生命周期

- 应用启动：检查 enabled 状态，若 true 则创建悬浮球
- 关闭开关：销毁悬浮球窗口
- 主窗口关闭：悬浮球保持显示（macOS）
- 应用退出：保存位置，销毁悬浮球

### REQ-FB-008: 悬浮球渲染层独立

- 悬浮球拥有独立的渲染器目录 `src/renderer-floating-ball/`，与主渲染器 `src/renderer/` 彻底解耦
- 独立 Vite 配置文件 `vite.floating-ball.config.ts`，`root` 指向新目录
- 独立 HTML 入口 `index.html`，独立 Vue 应用入口 `main.ts`
- 悬浮球 Vue 应用不加载 Pinia、Vue Router、App.vue 布局壳等主应用基础设施
- `forge.config.mjs` 中 `floating_ball` renderer 条目使用独立 Vite 配置
- `FloatingBallWindow` 使用 `FLOATING_BALL_VITE_*` 全局变量加载渲染器，不再使用 `MAIN_WINDOW_VITE_*`
- 主渲染器 `router.ts` 中移除 `/floating-ball` 路由及对应导航守卫
- 主渲染器中删除 `src/renderer/src/floating-ball/` 目录
- IPC 通道、shared types、preload 脚本保持不变
- 悬浮球通过 `window.electronAPI.registerEvent()` 接入主进程事件总线，与主应用共用同一套通知系统（见 REQ-FB-009）

### REQ-FB-009: 悬浮球接入通知系统

- 悬浮球渲染器启动时调用 `window.electronAPI.registerEvent({}, callback)` 注册到主进程事件总线
- 主进程 `EventController` 自动将调用者的 webContents 注册到 `EventService`
- 悬浮球可接收主进程推送的所有事件：`UPDATE_MESSAGE`、`SESSION_TITLE_UPDATED`、`TODO_UPDATED`、`CONTEXT_COMPRESSION_UPDATED` 等
- 事件回调在 `main.ts` 中注册（顶层调用，确保仅执行一次）
- 无需修改主进程代码（`EventService`、`EventController`）、preload 脚本或 IPC 通道

### REQ-FB-010: AI 流式输出状态动画

- 从 `packages/ui/src/components/StreamLoading.vue` 复制 SVG 螺旋动画组件到 `src/renderer-floating-ball/StreamLoading.vue`
- 悬浮球监听 `UPDATE_MESSAGE` 事件中的 `agent_start` 和 `agent_end` 类型，追踪 `isStreaming` 状态
- AI 正在输出（`isStreaming === true`）时，球体中心展示 StreamLoading 动画，隐藏 "W" 字母
- AI 空闲（`isStreaming === false`）时，展示 "W" 字母
- 动画尺寸适配 50x50 dp 球体（原组件为 24px `w-6`，需放大到约 `w-8` 即 32px）
- 事件监听在 `FloatingBall.vue` 的 `onMounted` 中通过 `window.electronAPI.registerEvent` 设置，`onUnmounted` 中无需清理（窗口销毁时自动解除）

### REQ-FB-011: LUI 面板与物理窗口动态尺寸

- 引入 IPC 常量 `RESIZE_FLOATING_BALL_WINDOW`。
- 主进程通过 `resizeWindow(width, height, focusable)` 方法，在需要展开 LUI（流式/审批/提问）时动态扩大窗口尺寸（如 420x180 或 420x280），在空闲或关闭时恢复 `80x80`。
- 重调大小算法：根据悬浮球在屏幕中线的物理位置（左半屏或右半屏），自动向左或向右偏移，确保球体部分的物理锚点相对屏幕位置保持不动；并通过工作区（`workArea`）边缘裁切防止卡片溢出屏幕。
- 窗口可聚焦状态管理：仅在遇到工具权限审批（`PermissionApprovalPanel`）或问答选择（`AskUserPanel`）需要用户键盘文本输入时，将 `focusable` 设为 `true` 并调用 `win.focus()` 聚焦；其他时间均保持 `focusable: false`。

### REQ-FB-012: 最近一层流式输出提取

- 悬浮球渲染层监听 `UPDATE_MESSAGE` 广播。
- 提取最近的流式更新消息的最后一个非空 chunk（即 `content` 数组的末尾项）。
- 状态提取映射规则：
  - `thinking` (思考)：显示 AI 的思考文本（提供紧凑样式和流式更新）。
  - `toolCall` (工具调用)：展示正在执行的工具中文语义化标题（如 "正在运行 Shell 脚本..."）。
  - `text` (内容输出)：展示最近几行流式文本。
- 流式结束后，若无新的审批或提问发生，设置 4 秒淡出收起计时器。

### REQ-FB-013: 权限审批与提问集成

- 在悬浮球内渲染 `@willow/ui` 的 `PermissionApprovalPanel` 和 `AskUserPanel`。
- 当 `state.toolApprovals` 中存在 `status === 'pending'` 的审批请求时，自动挂起 LUI 卡片，展开到高度 `280`，并开启可聚焦状态。
- 用户交互反馈：
  - 工具批准：调用 `window.electronAPI.resolveToolApproval`，传入 `decision: 'approved'`。
  - 工具拒绝 / AskUser 答复：允许使用键盘回车或点击提交，将文本或选项作为参数，调用 `resolveToolApproval` 提交，或在跳过时发送 `decision: 'rejected'`。

