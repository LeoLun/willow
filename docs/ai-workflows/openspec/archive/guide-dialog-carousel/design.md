# 设计文档：使用配置指引改为弹窗分页轮播

## 交互与视觉设计

### 1. 结构与布局 (Structure)

改造后的 `GuideDialog.vue` 高度将变得更小且更加固定，避免在切换页面时发生剧烈的高度跳跃（Layout Shift）。
我们将弹窗体固定在一个统一的最小高度（例如 `min-h-[300px]` 或固定高度），使得内容切换时非常平稳。

```
+---------------------------------------------------+
|  配置与使用指引 (1/3)                             |
|  -----------------------------------------------  |
|                                                   |
|       [ 图标 ]                                    |
|       标题 (例如: 1. 配置模型密钥)                 |
|       详细描述文本...                             |
|                                                   |
|       [ 配置操作按钮 (如: 配置 API Key) ]         |
|                                                   |
|  -----------------------------------------------  |
|  [ 指示点 o o o ]            [上一页]  [下一页/确定]  |
+---------------------------------------------------+
```

### 2. 步骤数据定义 (Step Data)

我们将定义一个包含 3 个步骤的数据结构：
```typescript
interface Step {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: Component;
  iconBg: string;
  iconColor: string;
  actionText?: string;
  actionEvent?: "go-to-settings" | "create-workspace";
}
```

具体步骤定义：
- **步骤 0**：配置模型密钥 (Model Config)
  - 图标：`Key` (amber-400, bg-amber-500/10)
  - 标题：配置模型密钥
  - 描述：Willow 支持极简的 DeepSeek 配置。前往设置填入你的 API Key，系统将自动激活内置的 V4 Pro 和 Flash 双模型。
  - 操作按钮：“配置 API Key” (触发 `go-to-settings` 并关闭弹窗)
- **步骤 1**：绑定项目工作空间 (Workspaces)
  - 图标：`FolderPlus` (indigo-400, bg-indigo-500/10)
  - 标题：绑定项目工作空间
  - 描述：你可以将 Willow 绑定至本地开发目录或文件夹。工作空间专属 Agent 将深度理解代码库，并为你自动编写与修改代码。
  - 操作按钮：“创建工作空间” (触发 `create-workspace` 并关闭弹窗)
- **步骤 2**：后台自动化工作流 (Automations)
  - 图标：`Clock` (emerald-400, bg-emerald-500/10)
  - 标题：后台自动化工作流
  - 描述：针对重复性高、流程长的处理任务，你可以配置 Cron 定时或按需运行的 AI 自动化流，关闭界面后依然会在后台静默完成。
  - 操作按钮：无

### 3. 页脚控制逻辑 (Footer Logic)

页脚将包含：
- **左侧：步骤指示器 (Step Indicators)**:
  - 展示 3 个小圆点，表示总共有 3 页，当前页高亮（例如 `bg-primary`），其他页为弱色（例如 `bg-muted-foreground/30`）。
- **右侧：导航按钮**:
  - **上一页 (Previous)**: 
    - 如果当前是第一步 (`currentStep === 0`)，则该按钮不可见（`v-if="currentStep > 0"`），保证布局干净且用户无法误触。
    - 否则可见，点击后 `currentStep.value--`。
  - **下一页 / 确定 (Next / Confirm)**:
    - 如果当前不是最后一步 (`currentStep < 2`)，按钮显示“下一页”，点击后 `currentStep.value++`。
    - 如果当前是最后一步 (`currentStep === 2`)，按钮显示“确定”，点击后触发 `close` 事件（关闭弹窗）。

### 4. 转场动画与过渡 (Transitions)

为了保证顺滑的用户体验：
- 采用 Vue 的 `<Transition>` 组件对内容区域进行包裹，使用横向淡入淡出（Slide/Fade）效果；
- 或者通过 CSS 配合简单的淡入过渡（Fade Transition）以符合桌面工作台简洁冷静的风格。

## 数据流与事件触发

- 页内操作按钮（“配置 API Key” / “创建工作空间”）点击后：
  1. 触发对应的 emit 事件 (`go-to-settings` / `create-workspace`)。
  2. 触发 `close` 事件关闭当前弹窗。
- 最后一页的“确定”按钮点击后：
  1. 触发 `close` 事件关闭当前弹窗。
