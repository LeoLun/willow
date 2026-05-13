# create-workspace-dialog Specification

## UI 稿（验收源）

实现和验收以 `ui/work.pen` 中以下两个 Frame 为准：

- **未选择目录状态**: `Willow / Create Workspace Dialog (未选择目录)` — 节点 ID `YXd7X`
- **已选择目录状态**: `Willow / Create Workspace Dialog (已选择目录)` — 节点 ID `L4Vpw`

两种状态的差异仅在于"项目目录（可选）"区域：
- `YXd7X` → 展示 outline 风格"选择目录"按钮（`Z9abc`），包含 `folder-open` 图标 + "选择目录"文字
- `L4Vpw` → 展示路径条（`aPndo`），包含 `folder` 图标 + 路径文本 + `check` 图标，使用 `secondary` 背景 + `border`

其余所有区域（Header、名称输入框、Footer 按钮组）在两个 UI 稿中完全一致。

## ADDED Requirements

### Requirement: 创建工作空间弹窗包含目录选择入口

创建新工作空间弹窗 MUST 提供可选的"选择目录"按钮，允许用户在创建时关联本地项目目录。实现和验收样式以 `ui/work.pen` 中 `YXd7X` 和 `L4Vpw` 为源。

#### Scenario: 弹窗展示选择目录按钮（对照 YXd7X）

- **前提** 用户打开创建新工作空间弹窗
- **并且** 尚未选择任何目录
- **当** 弹窗渲染完成
- **那么** 弹窗在名称输入框下方展示"项目目录（可选）"标签（对应 `t16bIZ`：fontSize 14, fontWeight 500, fill $--foreground）
- **并且** 展示一个全宽 outline 风格按钮（对应 `Z9abc`：height 36, cornerRadius 6, fill $--background, border $--border, shadow）
- **并且** 按钮包含 `folder-open` 图标（对应 `U4SiPr`：16×16, fill $--foreground）和"选择目录"文字（对应 `bZvoX`：fontSize 14, fontWeight 500）

#### Scenario: 点击按钮拉起原生文件夹选择器

- **前提** 创建新工作空间弹窗已打开
- **当** 用户点击"选择目录"按钮
- **那么** 系统调用 `electronAPI.selectDirectory()` 拉起系统原生文件夹选择对话框

#### Scenario: 用户选择文件夹后展示路径（对照 L4Vpw）

- **前提** 用户点击"选择目录"按钮
- **并且** 系统弹出原生文件夹选择对话框
- **当** 用户选择一个文件夹并确认
- **那么** 弹窗目录区域切换为"已选择目录"状态（对应 `L4Vpw` / `aPndo`）
- **并且** 展示选中文件夹的完整路径（对应 `KNexm`：fontSize 13, normal, fill $--foreground）
- **并且** 路径展示条包含 `folder` 图标（对应 `z0qioW`：16×16）和 `check` 图标（对应 `aTkMJ`：14×14, fill $--muted-foreground）
- **并且** 路径展示条使用 secondary 背景色（fill $--secondary）、border（stroke fill $--border）、cornerRadius 6、height 36

#### Scenario: 用户取消选择不改变状态

- **前提** 创建新工作空间弹窗已打开
- **并且** 尚未选择目录
- **当** 用户点击"选择目录"按钮后取消原生对话框
- **那么** 弹窗目录区域保持"未选择目录"状态（对应 `YXd7X`）
- **并且** 继续展示"选择目录"按钮

#### Scenario: 重新选择目录覆盖已有路径

- **前提** 弹窗已展示一个已选目录路径（`L4Vpw` 状态）
- **当** 用户再次点击路径展示条并选择新文件夹
- **那么** 弹窗更新展示为新选择的路径
- **并且** 旧路径被覆盖

### Requirement: 提交时携带选中目录路径

创建工作空间提交 MUST 将选中目录路径（如有）传入 `CreateWorkspaceRequest.path`。

#### Scenario: 已选择目录时提交

- **前提** 用户已输入工作空间名称
- **并且** 已选择一个目录路径
- **当** 用户点击"创建"按钮（对应 `v9rcU` / `ZEqQK`：fill $--primary, fontSize 14, fontWeight 500, fill $--primary-foreground）
- **那么** 系统调用 `createWorkspace({ name, path: selectedPath })`
- **并且** `path` 为选中目录的完整路径

#### Scenario: 未选择目录时提交

- **前提** 用户已输入工作空间名称
- **并且** 未选择目录（path 为空）
- **当** 用户点击"创建"按钮
- **那么** 系统调用 `createWorkspace({ name, path: "" })`
- **并且** 行为与现有逻辑完全一致

### Requirement: 目录选择为非必选项

目录选择 MUST NOT 影响工作空间名称的必填校验。

#### Scenario: 仅填写名称即可创建

- **前提** 用户输入了工作空间名称
- **并且** 未选择目录
- **当** 用户点击"创建"按钮
- **那么** 创建按钮可用，提交正常进行
- **并且** 不因未选择目录而阻止提交或显示错误

#### Scenario: 已选目录重新点击可切换

- **前提** 用户已选择了一个目录（`L4Vpw` 状态）
- **当** 用户点击路径展示条
- **那么** 系统再次调用 `electronAPI.selectDirectory()` 允许重新选择
- **并且** 若选择新目录则覆盖，若取消则保留原路径
