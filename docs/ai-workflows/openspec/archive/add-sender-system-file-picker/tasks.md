# Tasks: add-sender-system-file-picker

## 1. OpenSpec 与现状确认

- [x] 1.1 阅读历史 `add-sender-file-mention` OpenSpec，确认现有文件标签、`@` 文件选择和 `selectedFiles` 语义。
- [x] 1.2 阅读根目录 `DESIGN.md`，确认 renderer 工具栏按钮和工作台视觉约束。
- [x] 1.3 阅读当前 `@willow/sender`、`SenderContainer`、dialog IPC 和 preload 代码，确认系统文件选择入口落点。

## 2. app/work 系统文件选择能力

- [x] 2.1 在 shared constants 中新增 `SELECT_FILES`。
- [x] 2.2 在 shared API / dialog hook 中新增系统文件选择请求与响应类型。
- [x] 2.3 在 `DialogController` 中新增 `selectFiles` IPC，调用 Electron `dialog.showOpenDialog()` 选择文件并支持多选。
- [x] 2.4 在 preload `electronAPI` 中暴露 `selectFiles()`，并保持错误处理与现有 workspace/dialog API 一致。

## 3. `@willow/sender` 插入入口

- [x] 3.1 为 `Sender` 新增系统文件选择请求事件或等价受控插入 API。
- [x] 3.2 将左下 `+` 按钮定义为系统文件添加入口。
- [x] 3.3 为技能手动入口更换非 `+` 的技能/工具类图标，保留 `/` 触发能力。
- [x] 3.4 复用现有文件标签插入逻辑，支持批量插入并跳过重复路径。
- [x] 3.5 文件插入后保持编辑器聚焦，并同步 `editorFileKeys`。

## 4. app/work 宿主集成

- [x] 4.1 在 `SenderContainer.vue` 响应 sender 的系统文件选择请求。
- [x] 4.2 调用 `electronAPI.selectFiles({ multiSelections: true })`。
- [x] 4.3 将系统选择结果映射为 `SenderFileOption[]`。
- [x] 4.4 对工作空间内文件复用现有 `getRelativePath()`；对工作空间外文件保留完整 `path` 并提供稳定 `relativePath` 展示值。
- [x] 4.5 用户取消或选择失败时不清空草稿、不影响现有输入状态。

## 5. 验证

- [x] 5.1 手动验证点击 `+` 会打开系统文件选择器。
- [x] 5.2 手动验证取消选择时草稿不变。
- [x] 5.3 手动验证选择单个和多个文件后均插入文件标签。
- [x] 5.4 手动验证系统选择文件与 `@` 添加文件的标签视觉、`message` 文本和 `selectedFiles` payload 一致。
- [x] 5.5 手动验证重复选择同一路径文件不会重复插入。
- [x] 5.6 手动验证 `/` 技能选择和 `@` 工作区文件选择不回退。
- [x] 5.7 对触及的 TypeScript/Vue 代码运行 `pnpm lint`。
- [x] 5.8 如修改共享包或 IPC 类型后影响构建，运行 `pnpm build`。
