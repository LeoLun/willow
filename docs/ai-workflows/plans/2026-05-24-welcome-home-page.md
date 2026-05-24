# 执行计划：智能欢迎首页与配置引导弹窗集成

将经过 UI Playground 验证的“居中输入框欢迎首页”及“使用配置引导弹窗”集成到 Willow 桌面主应用中。

## 任务拆解与执行步骤

### 1. 修改 Chat.vue 的底部输入框展示条件
- **目标**：在会话为空时，隐藏主界面最底部的输入框，交由页面中央的输入框接管。
- **文件**：`app/work/src/renderer/src/pages/chat/Chat.vue`
- **步骤**：
  - 新增 `showBottomSender = computed(() => messageCount.value > 0 || state.isStreaming)` 控制属性。
  - 在路由 `<component>` 中透传 `:workspace-id="currentWorkspaceId"`、`chat-scope` 属性，并监听 `@send` 与 `@stop` 事件，实现逻辑流向上穿透。
  - 在底部 `<SenderContainer>` 渲染逻辑上，将 `v-else` 修改为 `v-else-if="showBottomSender"`。

### 2. 修改 Session.vue 实现空数据时居中渲染
- **目标**：在消息列表长度为 0 且非流式状态时，渲染新版的 `<WelcomeView>`，并通过 slot 将输入框置于正中。
- **文件**：`app/work/src/renderer/src/pages/chat/session/Session.vue`
- **步骤**：
  - 引入 `WelcomeView` 组件与 `SenderContainer` 组件。
  - 声明 `workspaceId`、`chatScope` props 并声明 `send`、`stop` 触发事件。
  - 新增 `showWelcome = computed(() => props.messages.length === 0 && !props.isStreaming)` 判定状态。
  - 编写 `@create-workspace`、`@go-to-settings` 与 `@select-workspace` 交互处理函数：
    - 创建工作空间：使用 `useDialog` 呼起 `CreateWorkspace` 对话框。
    - 前往配置：使用 `useRouter` 跳转到 `/setting/configuration`。
    - 上下文切换：若 `id === -1` 跳转到 `/conversation`；否则跳转到 `/?workspaceId=id`。
  - 在模板中，用 `v-if="showWelcome"` 渲染 `<WelcomeView>`，并将 `<SenderContainer>` 投递入它的 `sender` 插槽中；其余消息渲染逻辑用 `v-else` 包裹。

## 验证与测试步骤

### 自动化验证
- 运行 `pnpm lint` 验证前端代码是否有任何 Oxlint 错误。

### 手动验证
1. 打开应用，进入空会话（如 `/conversation`），确认中间显示 **“今天想完成什么任务？”**，输入框居中。
2. 点击输入框左下方的 **“对话 v”**，验证可正常展开并切换至具体的项目工作空间目录。
3. 点击右下侧 **“配置与使用指引”**，验证使用指引弹窗成功展示，点击对应按钮弹窗应自行关闭并成功跳转（例如跳转至设置页或拉起创建工作空间窗口）。
4. 在居中输入框中输入内容并发送，确认会话即时激活，输入框顺畅切换至底部，聊天消息气泡显示正常。
