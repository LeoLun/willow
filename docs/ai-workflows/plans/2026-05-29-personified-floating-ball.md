# 执行计划：拟人化悬浮球设计与动画

该计划旨在将现有的悬浮球螺旋线动画，替换为基于 SVG 形变与 CSS 动画的 Notion 风格“知识分子”拟人简笔画头像。

## 依赖与前提条件

- 前端环境运行正常。
- 可通过 `pnpm dev:ui` 或 `pnpm dev` 进行悬浮球独立及整合调试。

## 详细执行步骤

### 步骤 1：修改 `FloatingBall.vue` 传递 hover 状态

- 修改文件：[FloatingBall.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer-floating-ball/FloatingBall.vue)
- 找到 `<BallStreaming :streaming="isStreaming" />` 组件标签。
- 将其修改为：
  ```html
  <BallStreaming :streaming="isStreaming" :hovered="isHovered" />
  ```
  利用父组件已有的 `isHovered` 状态（由 `@mouseenter`/`mouseleave` 控制）同步悬停状态。

### 步骤 2：重构 `BallStreaming.vue`

- 修改文件：[BallStreaming.vue](file:///Users/liujinglun/code/willow/app/work/src/renderer-floating-ball/BallStreaming.vue)
- **Props 与 状态机**：
  - 声明 `streaming` (Boolean) 和 `hovered` (Boolean) props。
  - 声明 `activeState` 计算属性：
    ```typescript
    const activeState = computed(() => {
      if (props.streaming) return "thinking";
      if (props.hovered) return "hover";
      return "idle";
    });
    ```
- **SVG 路径动态计算**：
  - 左眉毛、右眉毛、嘴巴的 `d` 属性根据 `activeState` 返回相应的 SVG 二次贝塞尔曲线控制点（确保点数相同以触发 Morph 动画）。
  - 左右眼球的 `cx` 与 `cy` 根据 `activeState` 做对应偏移。
- **模板结构重构**：
  - 移除原有的螺旋线 `path` 与粒子 `circle`。
  - 新增镜框圆圈、鼻线、两眼圆圈、两个眉毛路径及嘴巴路径。
- **CSS 样式与关键帧**：
  - 为 `path` 和 `circle` 添加统一的缓动过渡：
    ```css
    path {
      transition: d 0.35s cubic-bezier(0.4, 0, 0.2, 1), stroke-width 0.35s ease;
    }
    circle {
      transition: cx 0.35s cubic-bezier(0.4, 0, 0.2, 1), cy 0.35s cubic-bezier(0.4, 0, 0.2, 1), r 0.35s ease;
    }
    ```
  - 定义眨眼动画（`blink`）应用在 `idle` 和 `hover` 状态下的眼球。
  - 定义眼球环顾（`look-around`）、右眉挑动（`wiggle-brow`）及面部轻微浮动（`float-face`）动画，在 `activeState === 'thinking'` 时通过 class 绑定启用。

---

## 验证计划

1. **静态检查与构建**：
   - 运行 `pnpm lint` 验证无语法及规范错误。
   - 运行 `pnpm build` 确认项目构建无误。

2. **功能与交互验证**：
   - 启动独立 UI Playground：`pnpm dev:ui`，导航至 `Floating Ball` 页面（或运行主应用 `pnpm dev`）。
   - **普通状态（Idle）**：悬浮球显示经典的带圆眼镜、平眉、无表情的极简学者脸。
   - **悬停状态（Hover）**：鼠标悬停在悬浮球上，表情应当平滑过渡为微笑，并伴随自动眨眼。
   - **运行状态（Thinking）**：切换 `streaming` 为 `true`，人脸应当切换为偏头、眼睛上瞟、右眉挑动并做浮动漂浮的思考状态。
