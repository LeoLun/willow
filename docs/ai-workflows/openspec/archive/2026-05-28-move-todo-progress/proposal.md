# 将 Todo 进度列表移动到输入框上方

## 动机
当前 Willow 桌面端应用中，任务执行进度（Todo 列表）展示在右侧边栏（ChatRightSidebar.vue）的“概要”标签页下。这种设计会导致：
1. 用户在查看和与 AI 交互的过程中，任务进度难以一眼直观看到，特别是在右侧边栏被折叠或切换至“文件”/“应用”标签页时。
2. 缺乏集中的状态反馈，任务执行列表作为输入框的上下文反馈应当放置于离用户注意力最近的地方（如输入框上方）。

## 目标
1. 从右侧边栏中移除任务进度区域（即不再在 `ChatRightSidebar.vue` 中显示 Todo 列表）。
2. 将 Todo 进度列表组件（`TodoProgress.vue`）移至主界面底部输入框（`SenderContainer.vue`）上方。
3. 默认展示当前 Todo 进度（即折叠态下的汇总进度和当前执行项）。
4. 点击后可以展开展示每一项 Todo 详情（即展开态下的完整列表）。

## 范围
- `app/work/src/renderer/src/pages/chat/components/ChatRightSidebar.vue`：移除 Todo 展示逻辑相关的标签和内容。
- `app/work/src/renderer/src/pages/chat/Chat.vue`：引入 `TodoProgress` 组件，并放置于底部输入框相关面板的上方，控制其在有任务且属于会话视图时展示。
- 组件及布局样式微调：确保 `TodoProgress` 组件在底部输入框上方排版美观、无视觉重叠，并符合 Willow 的极简及质感面板设计规范。

## 非范围
- 不修改 Todo 的数据流和状态维护逻辑（即保留 `useTodoProgress.ts` 的逻辑）。
- 不新增任何后端数据库 schema 或 IPC 接口。
