# 修复聊天流式输出时的滚动锁定问题

## 变更名称

`fix-chat-scroll-stick`

## 问题描述

当前聊天会话页面在 AI 流式输出过程中，用户无法向上滚动查看历史消息。即使用户主动向上滚动，页面也会被强制拉回底部，导致无法在输出过程中回顾上文内容。

### 根因分析

`Session.vue` 中 `scheduleScrollToBottom()` 使用 `nextTick` + 双层 `requestAnimationFrame` 异步排队多次 `scrollToBottom()`。当流式输出触发 watcher 或 `ResizeObserver` 回调时：

1. `scheduleScrollToBottom()` 被调用，排队多个延迟 scroll 操作
2. 用户向上滚动 → `handleScroll` 将 `shouldStickToBottom` 设为 `false`
3. 已排队的异步 `scrollToBottom()` 仍然执行，把视口拉回底部
4. 拉回底部触发 `handleScroll`，`isNearBottom()` 返回 `true` → `shouldStickToBottom` 重置为 `true`
5. 下一帧流式更新再次触发 `scheduleScrollToBottom()`，形成恶性循环

核心问题是 `scheduleScrollToBottom` 仅在调度时检查 `shouldStickToBottom`，但在实际执行 `scrollToBottom()` 时不再检查。

## 期望行为

1. **用户滚动后停止自动定位到底部**：流式输出期间，用户向上滚动后，页面不再自动跟随最新输出滚到底部
2. **显示"返回底部"按钮**：当用户不在底部时，在聊天滚动区域底部中央显示一个圆形向下箭头按钮（参考 WPS 灵犀的设计）
3. **点击返回底部并恢复自动滚动**：点击按钮后滚动到底部，同时恢复"跟随输出自动滚动到底部"的行为

## 推荐方案

本次变更范围明确、实现路径唯一，无需对比多方案。直接修复 `Session.vue` 中的滚动逻辑。

### 修复要点

1. **在 `scrollToBottom()` 执行时加入守卫**：每次实际执行 `scrollToBottom()` 前重新检查 `shouldStickToBottom`，如果为 `false` 则跳过
2. **添加"返回底部"浮动按钮**：
   - 圆形按钮，内含向下箭头图标（`ArrowDown` from `lucide-vue-next`）
   - 位于滚动区域底部中央，浮于内容之上
   - 仅当 `shouldStickToBottom === false` 时显示
   - 带轻量过渡动画（淡入淡出）
3. **点击按钮的行为**：设置 `shouldStickToBottom = true`，调用 `scrollToBottom()`

### 影响范围

- **仅修改** `app/work/src/renderer/src/pages/chat/session/Session.vue`
- 不涉及 `MessageList`、`StreamingMessageContainer`、composables 或其他组件
- 不引入新依赖

## 不在范围内

- 浮动球（`FloatingBall.vue`）的滚动行为
- `ConsoleBlock` 内部的自动滚动
- UI Playground 中的 mock 滚动
- 滚动位置持久化或跨会话恢复

## 验收标准

1. 流式输出期间，用户向上滚动后页面不再被拉回底部
2. 用户不在底部时，出现"返回底部"箭头按钮
3. 点击按钮后回到底部，后续流式输出继续自动滚动
4. 切换 session 时自动回到底部且按钮隐藏
5. 按钮视觉符合 DESIGN.md 规范（轻量、克制、工具型）

## 下一步

进入 `workflow-plan` 编写执行计划。
