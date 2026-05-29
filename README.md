# Willow Work

Willow Work 是一款专为高效任务执行与 AI 协作设计的桌面工作台（Desktop Workbench）应用。它通过深度融合 OpenSpec 研发流程，提供极简、冷静、专注的工具化使用体验。

## 核心功能

- **AI 协同研发工作流**：内置基于 OpenSpec 规范的 `workflow-*` 标准研发周期管理，包含需求澄清（`workflow-spec`）、建库隔离（`workflow-worktree`）、任务拆解（`workflow-plan`）、开发执行（`workflow-implement`）与收尾归档（`workflow-close`）一键化协作工具。
- **智能对话与上下文压缩**：支持高可读性的多轮对话记录，提供基于 Token 自动优化的上下文压缩（Context Compression）功能，极大减少大模型推理成本并提升长文本记忆精度。
- **任务循环与自动化流**：直观展示 Agent 执行的思考链路（ThinkingBlock）和工具调用（ToolCallCard），支持长任务循环的可视化折叠、操作权限主动询问（AskUserPanel）等交互。
- **工程化辅助与技能热重载**：支持 workspace 工作区一键初始化，以及 Agent 自定义技能的动态热重载（Hot Reload Skills），可在 UI 界面中直接调试、更新 Agent 执行逻辑。
- **桌面级工作台 UI**：基于 Electron + Vue 3 + Tailwind CSS v4 与 `@willow/shadcn` 深度定制，支持暗色模式，高信息密度，专为桌面业务生产力设计。

## macOS 安装包“已损坏”解决方法

如果在 macOS 上下载并安装本应用后，打开时提示 **“‘Willow Work’ 已损坏，无法打开。你应该将它移到废纸篓”**，这是由于应用未进行 Apple 开发者签名和公证，被系统 Gatekeeper 拦截所致。

请使用以下方法之一解决：

### 1. 移除应用的隔离属性（推荐）

将应用拖入“应用程序”文件夹（`/Applications`）后，在终端中运行以下命令：

```bash
xattr -cr /Applications/Willow\ Work.app
```

> **注**：如果应用存放在其他路径，请将命令中的路径替换为实际的 App 路径。

### 2. 移除 DMG 文件的隔离属性

你也可以在安装前，直接清除下载的 DMG 文件的隔离属性：

```bash
xattr -d com.apple.quarantine /path/to/Willow\ Work.dmg
```

### 3. 开启 macOS“任何来源”

1. 打开终端，运行以下命令（需要输入 Mac 开机密码）：
   ```bash
   sudo spctl --master-disable
   ```
2. 前往 Mac 的 **“系统设置” -> “隐私与安全” -> “安全性”**。
3. 在“允许从以下位置下载的应用程序”下，勾选新出现的 **“任何来源”**。
