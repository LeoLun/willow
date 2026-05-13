# add-directory-picker-to-create-workspace 任务

## UI 稿对照

- 未选择目录状态 → `YXd7X` (`Willow / Create Workspace Dialog (未选择目录)`)
- 已选择目录状态 → `L4Vpw` (`Willow / Create Workspace Dialog (已选择目录)`)

## 1. 修改 CreateWorkspace.vue

- [x] 1.1 新增 `path` ref（`ref("")`），管理选中目录路径。
- [x] 1.2 新增 `handleSelectDirectory` 函数，调用 `electronAPI.selectDirectory()` 并更新 `path`。
- [x] 1.3 在模板中名称输入框下方添加"项目目录（可选）"区域（对照 UI 稿 `ImHnY` / `c7X2bG`）。
- [x] 1.4 未选择目录时：展示全宽 outline 风格"选择目录"按钮（对照 `YXd7X` / `Z9abc`），包含 `FolderOpen` 图标 + "选择目录"文字。
- [x] 1.5 已选择目录时：展示路径条（对照 `L4Vpw` / `aPndo`），包含 `Folder` 图标 + 路径文本 + `Check` 图标，secondary 背景 + border。
- [x] 1.6 已选择目录时，点击路径展示条可重新拉起选择器。
- [x] 1.7 修改 `handleSubmit`，将 `path.value.trim()` 传入 `createWorkspace` 的 `path` 字段。

## 2. 验证

- [x] 2.1 对照 UI 稿 `YXd7X` 验收：弹窗打开 → 目录区域展示"选择目录"按钮（folder-open 图标 + 文字，全宽 outline 样式）。
- [x] 2.2 点击"选择目录" → 系统原生文件夹选择器弹出 → 选择文件夹 → 对照 UI 稿 `L4Vpw` 验收路径展示（folder 图标 + 路径 + check，secondary 背景 + border）。
- [x] 2.3 对照 UI 稿 `L4Vpw` 验收：再次点击路径条 → 重新拉起选择器 → 选择新路径覆盖旧路径。
- [x] 2.4 取消原生选择器 → 弹窗状态不变（保持 `YXd7X` 或 `L4Vpw` 状态）。
- [x] 2.5 不选目录直接填名称提交 → 行为与现有一致，`path=""`。
- [x] 2.6 选目录后提交 → `path` 携带选中路径。
- [x] 2.7 运行 `pnpm lint` 无新增错误。
