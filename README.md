# Willow Work

Willow Work 是一款专为高效任务执行与 AI 协作设计的桌面工作台（Desktop Workbench）应用。

## 核心功能

- **智能对话与上下文压缩**：支持高可读性的多轮对话记录，提供基于 Token 自动优化的上下文压缩（Context Compression）功能，极大减少大模型推理成本并提升长文本记忆精度。
- **任务循环与自动化流**：直观展示 Agent 执行的思考链路（ThinkingBlock）和工具调用（ToolCallCard），支持长任务循环的可视化折叠、操作权限主动询问（AskUserPanel）等交互。
- **工程化辅助与技能热重载**：支持 workspace 工作区一键初始化，以及 Agent 自定义技能的动态热重载（Hot Reload Skills），可在 UI 界面中直接调试、更新 Agent 执行逻辑。
- **桌面级工作台 UI**：基于 Electron + Vue 3 + Tailwind CSS v4 与 `@willow/shadcn` 深度定制，支持暗色模式，高信息密度，专为桌面业务生产力设计。

## macOS 提示“未打开”解决方法

如果在 macOS 上下载并安装本应用后，打开时提示 **“未打开‘Willow’。Apple
无法验证‘Willow’是否包含可能危害 Mac 安全或泄漏隐私的恶意软件”**，请按以下步骤处理：

1. 在提示窗口中点击 **“完成”**。
2. 前往 **“系统设置” → “隐私与安全性” → “安全性”**。
3. 找到 Willow 被阻止打开的提示，点击 **“仍要打开”**。
4. 在随后出现的确认窗口中再次确认打开。
