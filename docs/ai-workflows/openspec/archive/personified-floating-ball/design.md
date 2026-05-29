# 设计方案：拟人化悬浮球与动画

## 状态管理与传参

为了实现交互与动画，我们将 `BallStreaming.vue` 的入参进行扩展：

1. **父组件传递状态**：
   - `streaming` (Boolean)：标识 AI 当前是否处于运行/Streaming 状态。
   - `hovered` (Boolean)：标识用户鼠标是否悬停在悬浮球上。

2. **状态机状态划分**：
   在 `BallStreaming.vue` 中，根据传入的 Props 映射为 `activeState`：
   ```typescript
   const activeState = computed(() => {
     if (props.streaming) return 'thinking';
     if (props.hovered) return 'hover';
     return 'idle';
   });
   ```

3. **未来扩展性**：
   若后续增加 `success`、`error` 等状态，可直接在 `activeState` 的计算逻辑中扩展对应的分支即可。

---

## 界面与 SVG 路径设计

悬浮球大小为 `50px * 50px`，内部 SVG 设置 `viewBox="0 0 100 100"`，以下为五官的坐标和 SVG 路径定义：

### 1. 眼镜 (Glasses)
眼镜在普通、Hover 和思考状态下均保留，以维持“知识分子”的角色设定。
- **左镜框**：圆心 `(30, 48)`，半径 `13`
- **右镜框**：圆心 `(70, 48)`，半径 `13`
- **镜架桥 (Bridge)**：从左镜框右侧到右镜框左侧。
  - 路径：`M 43 48 Q 50 46 57 48`
- **眼镜腿 (Temples)**（可选，为了精简可省略或仅在边缘画一小段线，这里省略以保持干净的简笔画特征）。

### 2. 眼睛 (Eyes)
- **左眼球**：
  - `idle` / `hover` 状态：圆心 `(30, 48)`，半径 `3`
  - `thinking` 状态（眼睛上瞟）：圆心 `(32, 45)`，半径 `3`
- **右眼球**：
  - `idle` / `hover` 状态：圆心 `(70, 48)`，半径 `3`
  - `thinking` 状态（眼睛上瞟）：圆心 `(68, 45)`，半径 `3`

### 3. 鼻子 (Nose)
一个极简的 L 型或勾型鼻子。
- 路径：`M 49 49 L 49 58 Q 49 60 52 60`

### 4. 眉毛 (Eyebrows)
为了支持流畅的过渡（Morphing），不同状态下的眉毛路径将使用**相同数量的控制点**（使用 `Q` 指令绘制的二次贝塞尔曲线）。
- **左眉毛**：
  - `idle` (普通)：`M 19 29 Q 30 23 41 29`
  - `hover` (略微抬起)：`M 19 26 Q 30 20 41 26`
  - `thinking` (挑起)：`M 19 24 Q 30 19 41 27`
- **右眉毛**：
  - `idle` (普通)：`M 59 29 Q 70 23 81 29`
  - `hover` (略微抬起)：`M 59 26 Q 70 20 81 26`
  - `thinking` (皱眉向下)：`M 59 29 Q 70 32 81 28`

### 5. 嘴巴 (Mouth)
嘴巴也同样保持相同数量的节点，以支持平滑形变过渡。
- **嘴巴路径**：
  - `idle` (平直)：`M 41 72 Q 50 72 59 72`
  - `hover` (微笑曲线)：`M 38 70 Q 50 78 62 70`
  - `thinking` (抿嘴/轻微歪嘴)：`M 41 73 Q 50 69 59 72`

---

## 动画效果实现

### 1. 过渡效果 (Morph Transitions)
所有五官路径（眉毛、嘴巴）和圆心位置（眼睛）均应用 CSS `transition` 以在状态切换时实现平滑动画：
```css
path {
  transition: d 0.35s cubic-bezier(0.4, 0, 0.2, 1), stroke-width 0.35s ease;
}
circle {
  transition: cx 0.35s cubic-bezier(0.4, 0, 0.2, 1), cy 0.35s cubic-bezier(0.4, 0, 0.2, 1), r 0.35s ease;
}
```

### 2. 眨眼动画 (Blink Animation)
在 `idle` 和 `hover` 状态下启用眨眼，眼睛会每隔 4 秒眨一次眼：
```css
@keyframes blink {
  0%, 96%, 100% {
    transform: scaleY(1);
  }
  98% {
    transform: scaleY(0.1);
  }
}
.animate-blink {
  animation: blink 4.5s infinite;
  transform-origin: 34px 48px; /* 左眼 */
}
.animate-blink-right {
  animation: blink 4.5s infinite;
  transform-origin: 66px 48px; /* 右眼 */
}
```

### 3. 思考中动画 (Thinking Animation)
当进入 `thinking` 状态时，添加以下动态循环：
- **面部整体浮动 (Float)**：整个面部五官组 `<g>` 在垂直方向上做缓慢的上下漂浮（呼吸效果）：
  ```css
  @keyframes float-face {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-3.5px);
    }
  }
  .animate-float {
    animation: float-face 3.2s ease-in-out infinite;
  }
  ```
- **右眉挑动 (Puzzled Brow)**：右眉在思考状态下做细微的高低起伏：
  ```css
  @keyframes wiggle-brow {
    0%, 100% {
      transform: translateY(0) rotate(0deg);
    }
    50% {
      transform: translateY(-3px) rotate(-4.5deg);
    }
  }
  .animate-wiggle-brow {
    animation: wiggle-brow 2.2s ease-in-out infinite;
    transform-origin: 66px 29px;
  }
  ```
- **眼神看周围 (Look Around)**：思考时眼珠左右轻微扫视：
  ```css
  @keyframes look-around {
    0%, 100% {
      transform: translate(0, 0);
    }
    25% {
      transform: translate(-3px, -0.8px);
    }
    50% {
      transform: translate(0, -2.2px);
    }
    75% {
      transform: translate(3px, -0.8px);
    }
  }
  .animate-look-around {
    animation: look-around 4s ease-in-out infinite;
  }
  ```
