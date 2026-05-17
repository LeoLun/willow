# 悬浮球任务列表

## 1. 基础设施

- [x] 1.1 引入 `electron-store` 依赖（或实现 JSON 文件存储），定义 `FloatingBallStore` 类型
- [x] 1.2 新增 `FloatingBallService`（`app/work/src/main/service/floating-ball.service.ts`），管理悬浮球生命周期与配置读写

## 2. 悬浮球窗口

- [x] 2.1 新增 `FloatingBallWindow`（`app/work/src/main/window/floating-ball.window.ts`），定义窗口参数（无边框、60x60、置顶、透明）
- [x] 2.2 在 `forge.config.mjs` 的 `renderer` 数组中新增 `floating_ball` 条目
- [x] 2.3 在 `AppModule` 中注册 `FloatingBallWindow` 和 `FloatingBallService`

## 3. IPC 通道

- [x] 3.1 在 `shared/constants.ts` 中新增 IPC 通道常量：
  - `GET_FLOATING_BALL_CONFIG` — 获取悬浮球配置（enabled, x, y）
  - `SET_FLOATING_BALL_ENABLED` — 设置启用状态
  - `SET_FLOATING_BALL_POSITION` — 更新位置
  - `SHOW_MAIN_WINDOW` — 唤起主窗口
  - `SHOW_FLOATING_BALL_MENU` — 弹出右键菜单
- [x] 3.2 新增 `FloatingBallController`（`app/work/src/main/controllers/floating-ball.controller.ts`）
- [x] 3.3 在 `preload.ts` 中注册新的 IPC 方法
- [x] 3.4 在 `shared/api.ts` 中新增对应的请求/响应类型

## 4. 悬浮球 UI

- [x] 4.1 新增悬浮球 renderer 入口文件，加载 FloatingBall.vue
- [x] 4.2 新增 `FloatingBall.vue` 组件（圆形按钮、拖拽区域、左右键交互）
- [x] 4.3 实现左键点击唤起主窗口
- [x] 4.4 实现右键 IPC 通知主进程弹出菜单
- [x] 4.5 实现拖拽移动 + 位置 debounce 上报
- [x] 4.6 右键菜单新增"关闭悬浮球"操作，关闭窗口并持久化关闭状态

## 5. 设置页面

- [x] 5.1 新增 `FloatingBallSetting.vue`（Toggle 开关 + 说明文字）
- [x] 5.2 在 `router.ts` 中注册 `/setting/floating-ball` 路由
- [x] 5.3 在 `Setting.vue` 侧边栏中新增"悬浮球"导航项（使用合适的 lucide 图标）

## 6. 生命周期与边界处理

- [x] 6.1 应用启动时检查 enabled 状态，按需创建悬浮球
- [x] 6.2 监听设置变更，动态创建/销毁悬浮球
- [x] 6.3 处理主窗口关闭时悬浮球保持（macOS）
- [x] 6.4 处理屏幕切换/外接显示器断开时位置回退
- [x] 6.5 实现"退出登录"菜单项（清除 API Key）
- [x] 6.6 右键菜单绑定悬浮球窗口，避免主窗口 hide 后被右键菜单唤起

## 7. macOS 跨桌面支持

- [x] 7.1 在 `FloatingBallWindow.onInit()` 中调用 `win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` 实现跨桌面显示
- [x] 7.2 将 `setAlwaysOnTop(true, 'status')` 在 `onInit()` 中显式调用，提升层级至 Dock/菜单栏之上

## 9. 悬浮球渲染层独立拆分

- [x] 9.1 创建独立渲染器目录 `src/renderer-floating-ball/`，包含 `index.html`、`main.ts`、`FloatingBall.vue`、`style.css`
- [x] 9.2 创建独立 Vite 配置 `vite.floating-ball.config.ts`，root 指向新目录，仅含 `vue()` 和 `tailwindcss()` 插件
- [x] 9.3 更新 `forge.config.mjs`，floating_ball renderer 条目改用 `vite.floating-ball.config.ts`
- [x] 9.4 更新 `floating-ball.window.ts`，使用 `FLOATING_BALL_VITE_DEV_SERVER_URL` 和 `FLOATING_BALL_VITE_NAME` 替代 `MAIN_WINDOW_VITE_*`
- [x] 9.5 清理主渲染器：`router.ts` 移除 `/floating-ball` 路由和 `?route=/floating-ball` 导航守卫
- [x] 9.6 删除 `src/renderer/src/floating-ball/` 目录
- [x] 9.7 在 `FloatingBall.vue` 中通过 `registerEvent` 接入主进程事件通知系统（注：从 main.ts 移至组件内，以便组件直接响应事件更新 UI 状态）

## 10. 悬浮球视觉效果修复

- [x] 10.1 `floating-ball.window.ts` 添加 `hasShadow: false` 关闭 macOS 原生窗口投影
- [x] 10.2 `FloatingBall.vue` 移除 `shadow-lg`，替换为 `filter: drop-shadow(...)` 避免透明窗口上的白色边界

## 11. AI 流式输出动画

- [x] 11.1 从 `packages/ui/src/components/StreamLoading.vue` 复制到 `src/renderer-floating-ball/StreamLoading.vue`，尺寸适配为 `w-8`
- [x] 11.2 `FloatingBall.vue` 中监听 `UPDATE_MESSAGE` 事件，追踪 `isStreaming` 状态（`agent_start` → true，`agent_end` → false）
- [x] 11.3 模板中根据 `isStreaming` 切换显示：流式中显示 `<StreamLoading />`，空闲时显示 "W" 字母

## 12. 验证

- [x] 12.1 运行 `pnpm lint` 通过
- [x] 12.2 运行 `pnpm build` 通过
- [x] 12.3 手动测试：悬浮球显示为完美圆形，无白色边界
- [x] 12.4 手动测试：AI 对话输出时悬浮球展示 StreamLoading 动画，输出结束后恢复 "W" 字母
- [x] 12.5 手动测试：基础交互功能回归（左键唤起、右键菜单、拖拽移动）
- [x] 12.6 手动测试：右键菜单选择"关闭悬浮球"后悬浮球关闭，设置开关状态为关闭
- [x] 12.7 手动测试：主窗口 hide 后右键悬浮球只弹出菜单，不触发主窗口 show
