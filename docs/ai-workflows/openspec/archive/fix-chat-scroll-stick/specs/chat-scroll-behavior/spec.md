# 聊天滚动行为规格

## 概述

定义聊天会话页面在流式输出过程中的滚动行为规则，以及"返回底部"按钮的交互细节。

## 滚动状态机

聊天滚动区域维护一个布尔状态 `shouldStickToBottom`，控制是否跟随新内容自动滚动到底部。

### 状态转换

```
┌──────────────────┐         用户向上滚动          ┌────────────────────┐
│                  │  ────────────────────────────> │                    │
│  stickToBottom   │                                │  freeScroll        │
│  (自动跟随底部)  │  <──────────────────────────── │  (自由浏览)        │
│                  │    点击返回按钮 / 手动滚到底部  │                    │
└──────────────────┘                                └────────────────────┘
```

### stickToBottom 状态

- 新内容到达（watcher / ResizeObserver）时自动滚动到底部
- "返回底部"按钮隐藏

### freeScroll 状态

- 新内容到达时不滚动，用户视口保持不变
- "返回底部"按钮显示

### 转换条件

| 从 | 到 | 触发 |
|---|---|---|
| stickToBottom | freeScroll | 用户主动向上滚动，使视口离开底部（阈值 > 32px） |
| freeScroll | stickToBottom | 用户点击"返回底部"按钮 |
| freeScroll | stickToBottom | 用户手动滚动回到底部（距底 ≤ 32px） |
| any | stickToBottom | 切换 session（`sessionId` 变化） |

## 防抖与守卫

`scheduleScrollToBottom()` 排队的每个异步 `scrollToBottom()` 调用在执行时必须重新检查 `shouldStickToBottom`。如果为 `false`，跳过实际滚动。这是解决当前竞态条件的核心修复。

## "返回底部"按钮

### 视觉规格

- **形状**：圆形，`size-8`（32px）
- **图标**：`ArrowDown`（`lucide-vue-next`），`size-4`
- **位置**：滚动区域底部水平居中，距底部 `bottom-4`（16px）
- **层级**：浮于消息内容之上（`absolute` 定位，相对于滚动区域外层容器）
- **样式**：使用 `Button` 组件，`variant="outline"` + `size="icon"`，搭配 `bg-background` 实底背景和轻量 `shadow-sm` 边框阴影
- **过渡**：`Transition` 组件包裹，使用 `opacity` + `translateY` 过渡（`duration-200`）

### 交互

- 点击：设置 `shouldStickToBottom = true`，调用 `scrollToBottom()`
- 不响应键盘快捷键（无全局热键绑定）
- Tooltip：不需要，按钮含义不言自明

### 可见性

- `shouldStickToBottom === false` 时显示
- `shouldStickToBottom === true` 时隐藏
- 消息列表为空（`showWelcome`）时隐藏
