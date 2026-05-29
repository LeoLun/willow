# 提案：拟人化悬浮球设计与动画实现

## 动机

当前桌面的悬浮球（Floating Ball）在 AI 执行任务或输出时使用的是一个六瓣螺旋线（Six-Petal Spiral）的抽象旋转动画。为了增强人机交互的亲和力，给用户带来更温暖、更具协作感的体验，我们计划将该悬浮球的视觉效果重构为**拟人化简笔画**形式，采用方案 B 中的“知识分子/学者 (Scholar)”形象。

通过细腻的状态转换动画，让悬浮球在不同阶段展现出“专注”、“微笑”以及“思考”的神态，拉近 AI 与用户的心理距离。

## 目标

1. **形象重构**：将悬浮球的渲染核心从螺旋线 SVG 改为 Notion 风格的极简“知识分子”人脸。
2. **状态绑定**：
   - **普通状态**：展示经典的“知识分子”面孔（带圆框眼镜、拱形眉毛、平直嘴角、圆点眼睛）。
   - **Hover 状态**：嘴角弯曲成微笑，眼睛增加自动眨眼效果，眉毛微升。
   - **运行/Streaming 状态**：切换为思考模式（一只眉毛挑起、眼睛向上/左右看、整张脸轻微浮动呼吸）。
3. **扩展性支持**：重构传参机制，为后续接入更多动画状态（如 `success` 成功、`error` 错误、`sleep` 休眠）预留接口。

## 范围

- 修改前端渲染组件：
  - [FloatingBall.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer-floating-ball/FloatingBall.vue)（增加 hover 状态传递）
  - [BallStreaming.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer-floating-ball/BallStreaming.vue)（重构为 SVG 人脸及动画控制）
- 验证界面：
  - [FloatingBallDemo.vue](file:///Users/liujinglun/code/willow/app/ui-playground/src/demos/scenes/FloatingBallDemo.vue)（确保 UI Playground 调试正常）

## 非范围

- 主进程逻辑（窗口拖拽、菜单弹出、IPC 消息通知机制保持不变）。
- 右侧展开卡片（LUI Card）的样式和核心逻辑。
