# 任务列表：拟人化悬浮球

## 1. 隔离开发分支准备

- [x] 在 `workflow-worktree` 阶段拉取干净的开发分支（直接在工作区进行，跳过工作树）。

## 2. 修改 FloatingBall.vue 父组件

- [x] 更新 [FloatingBall.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer-floating-ball/FloatingBall.vue)：
  - 确保将 `isHovered` 作为 `hovered` Prop 传递给 `<BallStreaming>` 组件：
    ```html
    <BallStreaming :streaming="isStreaming" :hovered="isHovered" />
    ```

## 3. 重构 BallStreaming.vue 渲染逻辑与动画

- [x] 重构 [BallStreaming.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer-floating-ball/BallStreaming.vue)：
  - 声明 `hovered` 和 `streaming` Props。
  - 定义 `activeState` 计算属性，返回 `'idle' | 'hover' | 'thinking'`（预留其他状态扩展）。
  - 根据状态定义计算属性返回对应的 SVG 路径数据（眉毛、眼睛坐标、嘴巴路径）。
  - 将 SVG 模板重构为人脸结构：
    - 带阴影和背景的 SVG 画布（`viewBox="0 0 100 100"`，黑线描边）。
    - 镜框、镜架、左眼、右眼、鼻子、左眉、右眉、嘴巴。
  - 编写 CSS：
    - 为 `path` 和 `circle` 添加 CSS 过渡，使路径切换和圆心移动产生 Morph 动画。
    - 编写并绑定眨眼（`blink`）、左右环顾（`look-around`）、眉毛抖动（`wiggle-brow`）及面部轻微漂浮（`float-face`）的关键帧动画。

## 4. 验证与构建

- [x] 运行 `pnpm lint` 确保无 Oxlint 代码规范错误。
- [x] 运行 `pnpm build` 确认项目编译正常。
- [x] 启动 UI 体验环境 `pnpm dev:ui`（或 `pnpm dev` 运行主应用），在悬浮球页面：
  - 验证默认状态是否为经典的“知识分子”戴眼镜造型。
  - 悬停鼠标（Hover）到悬浮球上，验证其是否平滑变为微笑，且眼睛有每隔 4 秒的眨眼动画。
  - 在 AI 执行中（开启 `streaming`，可在 Playground 模拟），验证是否平滑切换为偏头思考的动画（眼神环顾、偏眉挑动、浮动呼吸）。
