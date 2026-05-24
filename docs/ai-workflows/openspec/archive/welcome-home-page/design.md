# 设计文档：智能欢迎首页 (Welcome View)

为了给用户提供友好且高级的初始化引导，我们将设计并实现一个欢迎首页组件，并在无数据状态下默认展示它。

## 界面与布局设计

欢迎首页将作为 `Session.vue` 中无消息且不处于加载流状态下的默认占位内容。页面结构如下：

1. **引导词区域**
   - 在输入框正上方展示中等字号的引导标题：“今天想完成什么任务？”。
   - 样式选用中性色、字号 `text-xl` 与 `font-semibold`，符合 Willow 桌面工作台“冷静、专注”的视觉质感。

2. **输入框区域**
   - 居中展示 `sender` 插槽（插槽内由父组件传入 `<Sender>` 输入框组件）。

3. **底部选项栏**
   - **左侧：上下文切换选择器**
     - 整合全局对话与项目工作空间的切换。默认展示为 **“对话”**（带绿色 `MessageSquare` 图标）。
     - 点击可展开下拉菜单，快速在“对话”和各个项目工作空间（展示为紫色 `Folder` 图标）之间一键切换。
   - **右侧：配置与使用指引**
     - 提供一个链接按钮（Compass 图标），点击后将唤起使用配置引导弹窗。

## 数据流与事件机制

1. **交互事件触发**：
   - 快捷动作“创建工作空间”：点击后，组件通过调用 `useDialog` 直接打开已有的 `CreateWorkspace` 弹窗。
   - 快捷动作“配置模型设置”：点击后，调用 `useRouter` 跳转到 `/setting/configuration`。
   - 快捷动作“开始对话” / 点击 Prompt 建议词：由于输入框与输入编辑器属于 `@willow/sender`，我们利用浏览器标准的 DOM 事件（CustomEvent）进行跨组件解耦通信：
     - 发送事件：`window.dispatchEvent(new CustomEvent('insert-prompt', { detail: promptText }))`
     - 接收事件：`Sender.vue` 内部监听 `insert-prompt` 事件，将内容写入 Tiptap 编辑器并自动聚焦。
     - 聚焦事件：`window.dispatchEvent(new CustomEvent('focus-prompt'))`。接收事件：`Sender.vue` 内部聚焦。
   - 上下文切换：在左下角切换选项时，触发 `select-workspace` 事件：
     - 传入 `-1` 时，切换至全局对话模式。
     - 传入具体项目 ID 时，切换至工作空间模式。

## 组件细节与样式

- **组件路径**：`app/work/src/renderer/src/pages/chat/session/components/WelcomeView.vue`
- **样式规范**：
  - 使用 Tailwind 样式配合已有的主题 CSS 变量（如 `bg-background`、`text-foreground`、`border-border` 等）。
  - 圆角统一遵循 `--radius`。
  - 信息密度偏紧凑，文字说明简短明确。
