# add-directory-picker-to-create-workspace

## Summary

为创建新工作空间弹窗添加"选择目录"按钮，允许用户在创建工作空间时（可选地）指定一个本地项目目录。实现和验收以 `ui/work.pen` 中 UI 稿为准。

## UI 稿（验收标准源）

| 状态 | Frame 名称 | 节点 ID |
|------|-----------|---------|
| 未选择目录 | `Willow / Create Workspace Dialog (未选择目录)` | `YXd7X` |
| 已选择目录 | `Willow / Create Workspace Dialog (已选择目录)` | `L4Vpw` |

两种状态的差异仅在于"项目目录（可选）"区域：未选择时展示"选择目录"按钮，已选择时展示路径条。

## Problem

当前 `CreateWorkspace.vue` 弹窗只允许输入工作空间名称，`path` 字段硬编码为空字符串（`""`）。用户无法在创建时关联一个本地项目目录。

- `CreateWorkspaceRequest.path` 已是可选字段，后端 `create.workspace.controller.ts` 已支持 `path` 参数。
- `electronAPI.selectDirectory()` 已在 IPC 层完整实现（preload、main controller、类型定义），但当前无任何 UI 调用它。
- UI 稿已在 `ui/work.pen` 中完成两种状态的视觉设计，是本变更的实现和验收标准。

## Goals

- 按照 `ui/work.pen` 中 UI 稿实现两种状态的视觉效果。
- 点击"选择目录"按钮后调用 `electronAPI.selectDirectory()` 拉起系统原生文件夹选择器。
- 选择目录后在弹窗中展示选中路径（`已选择目录` 状态），样式严格参照 UI 稿。
- 提交时将选中路径写入 `CreateWorkspaceRequest.path`。
- 未选择目录时行为不变，`path` 仍为空字符串。

## Non-Goals

- 不修改后端 `createWorkspace` 逻辑或 `CreateWorkspaceRequest` 类型定义。
- 不新增 IPC 通道；复用已有的 `selectDirectory`。
- 不修改弹窗标题、描述文案之外的 UI 布局结构。
- 不在本次变更中添加路径校验（如目录是否存在、是否可读写）。

## Success Criteria

- 弹窗中"项目目录（可选）"区域的两种状态与 UI 稿 `YXd7X` / `L4Vpw` 视觉一致。
- 点击"选择目录"按钮后系统弹出原生文件夹选择对话框。
- 选定文件夹后，弹窗切换为已选择状态（folder 图标 + 路径 + check 图标，secondary 背景 + border）。
- 提交时 `path` 字段携带选中路径；未选择时 `path` 仍为空字符串。
- 最终通过 `pnpm lint` 检查。

## Viable Approaches

### Approach A: 在现有弹窗组件内直接添加（推荐）

在 `CreateWorkspace.vue` 中新增一个 ref `path`、一个 outline 风格的"选择目录"按钮、以及选定路径后的展示区域。仅修改一个文件。

优点：
- 改动最小，依赖全部已有，无需新文件。
- UI 稿已明确两种状态，实现路径清晰。

缺点：
- 无。

### Approach B: 抽取独立目录选择器组件

将目录选择逻辑抽取为可复用组件 `<DirectoryPicker>`，在 `CreateWorkspace.vue` 中使用。

优点：
- 组件可被其他弹窗复用。

缺点：
- 当前无其他弹窗需要目录选择，过早抽象。
- 增加文件数量和测试表面积。

## Recommendation

采用 **Approach A**。当前只有一个使用场景，直接在 `CreateWorkspace.vue` 中添加即可。若后续有复用需求再抽取组件。

## Next Step

进入 `workflow-plan` 或 `workflow-implement` 进行实现。
