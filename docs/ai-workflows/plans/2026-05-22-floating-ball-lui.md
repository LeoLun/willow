# 悬浮球 LUI (Language User Interface) 执行计划

## 目标

为常驻桌面的悬浮球设计并集成流式思考/工具调用/文本卡片，提供工具权限审批和提问交互支持。

## 审查重点

- 双向尺寸调节（80x80 到 420xH）及位置自适应防屏幕溢出计算。
- 窗口可聚焦状态在交互发生时动态切换，以免平时抢占焦点。
- `@willow/ui` 面板组件的样式引入和事件对接。

## 提出变更

1. **共享和 IPC 配置**：
   - `app/work/src/shared/constants.ts` -> 新增 `RESIZE_FLOATING_BALL_WINDOW` 通道常量。
   - `app/work/src/shared/api.ts` -> 声明 `ResizeFloatingBallWindowRequest` / `Response`。
   - `app/work/src/preload/preload.ts` -> 暴露 `resizeFloatingBallWindow` 渲染 API。

2. **主进程扩展**：
   - `app/work/src/main/controllers/floating-ball/resize.floating.ball.window.controller.ts` -> [NEW] 转发 IPC 重调大小请求。
   - `app/work/src/main/service/floating-ball.service.ts` -> 实现 `resizeWindow` 的屏幕工作区自适应算法。
   - `app/work/src/main/app.module.ts` -> 导入并注册控制器。

3. **打包别名**：
   - `app/work/vite.floating-ball.config.ts` -> 引入 `@willow/ui` 及 `@willow/shadcn` 的源目录别名指向。

4. **渲染交互**：
   - `app/work/src/renderer-floating-ball/FloatingBall.vue` -> 解析 `UPDATE_MESSAGE`，管理 LUI 和审批面板渲染与销毁，动态触发大小缩放。

## 验证计划

1. 确认无 lint 和编译打包报错（`pnpm lint && pnpm build`）。
2. 在 `pnpm dev` 下进行对话流、权限申请、AskUser 提问的全流程输入及自适应测试。
