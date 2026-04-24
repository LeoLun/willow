# Design: add-sender-system-file-picker

## Overview

本变更在聊天发送器左下工具栏增加一个系统文件选择入口。系统文件选择由 `app/work` 通过 Electron 主进程完成，`@willow/sender` 只负责展示 `+` 按钮、发出选择请求、接收宿主返回的文件并插入已有文件标签。

现有 `@` 工作区文件选择能力继续保留：它面向“搜索当前工作空间文件”。新的 `+` 入口面向“从系统文件选择器添加文件”。两者最终都生成相同的 `FileTag` 和 `selectedFiles`。

## Current State

`@willow/sender` 当前已有：

- `FileTag` Tiptap inline atom。
- `Editor.insertFileTag(attrs)`。
- `Editor.getFileTags()`。
- `Sender.handleFileSelect(file)`，可将 `SenderFileOption` 插入文件标签。
- `selectedFiles` send payload。
- 左下工具栏中一个 `PlusIcon` 技能入口和一个 `FileTextIcon` 工作区文件入口。

`app/work` 当前已有：

- `DialogController.selectDirectory()`，使用 Electron `dialog.showOpenDialog()` 选择目录。
- `DialogController.openPath()`。
- preload 中的 `electronAPI.selectDirectory()` 与 `electronAPI.openPath()`。
- `SenderContainer.vue`，负责把工作空间文件树转换为 `SenderFileOption[]` 并传入 sender。

## Public API Changes

### `@willow/sender`

`Sender` 增加一个宿主回调式文件选择能力：

- 新事件：`select-files`
- 推荐事件签名：`select-files: [(insertFiles: (files: SenderFileOption[]) => void) => void]`

事件发出时，sender 将一个受控插入函数交给宿主。宿主完成系统文件选择后调用该函数，sender 内部复用与 `@` 文件面板相同的插入路径：

- 逐个检查文件 key。
- 已存在的文件跳过。
- 插入 `FileTag`。
- 插入后同步 `editorFileKeys`。
- 聚焦编辑器。

如果实现阶段发现 Vue emit 传函数不符合项目偏好，也可以改成在 `Sender` 暴露 `insertFiles(files: SenderFileOption[])` 方法，并由 `SenderContainer` 通过 ref 调用；但必须保持“宿主选择文件、sender 插入标签”的边界。

### `app/work` Dialog API

新增系统文件选择 IPC：

- 常量：`SELECT_FILES`
- 请求类型：`SelectFilesRequest`
- 响应类型：`SelectFilesResponse`

建议类型：

```ts
export interface SelectedSystemFile {
  name: string;
  path: string;
  size?: number;
  extension?: string;
}

export interface SelectFilesRequest {
  defaultPath?: string;
  multiSelections?: boolean;
}

export interface SelectFilesResponse {
  selected: boolean;
  files: SelectedSystemFile[];
}
```

主进程使用：

```ts
dialog.showOpenDialog({
  title: "选择文件",
  defaultPath,
  properties: multiSelections ? ["openFile", "multiSelections"] : ["openFile"],
})
```

取消时返回 `{ selected: false, files: [] }`。

## Sender Toolbar Behavior

输入器左下角应把 `+` 明确作为“添加文件”入口。

为避免与现有技能入口的 `PlusIcon` 冲突，推荐调整工具栏图标语义：

- `+`：系统文件选择器入口。
- 技能手动入口：改用更能表达技能/工具的 lucide 图标，例如 `WandSparklesIcon` 或 `BlocksIcon`，并保留 `/` 键盘触发。
- 工作区文件面板入口：可继续使用 `FileTextIcon`，用于打开当前工作空间文件搜索面板。

所有纯图标按钮必须有 `sr-only` 文案；不明显的图标应使用 `Tooltip`，文案保持短句，例如“添加文件”“选择技能”“工作区文件”。

## Host Mapping

`SenderContainer.vue` 处理 `select-files`：

1. 调用 `electronAPI.selectFiles({ multiSelections: true, defaultPath })`。
2. 用户取消时直接返回。
3. 将 `SelectedSystemFile[]` 映射为 `SenderFileOption[]`。
4. 对位于当前工作空间内的文件，`relativePath` 使用现有 `getRelativePath(file.path, workspaceFiles.rootPath.value)`。
5. 对不在当前工作空间内的文件，`relativePath` 建议使用文件名或完整路径的稳定展示值；`path` 必须保留完整路径。
6. 调用 sender 提供的插入函数。

文件扩展名建议从主进程返回；若主进程未返回，renderer 可用文件名末尾后缀补齐。

## File Tag And Payload Semantics

系统选择文件必须复用现有文件标签语义：

- 标签属性包含 `name`、`path`、`relativePath`、可选 `extension`。
- `renderText()` 继续输出 `[name](path)` 形式。
- `selectedFiles` 继续由编辑器里的 `FileTag` attributes 生成。
- 不通过解析 `message` 文本反推文件列表。

本变更不改变当前“仅文件标签且无正文不可发送”的行为，除非实现阶段发现现有逻辑已经允许文件引用作为正文。若要改变发送空正文规则，必须回到 OpenSpec 更新要求。

## Visual And Interaction Constraints

- `+` 按钮位于输入器左下工具栏第一组动作中，尺寸与现有工具按钮一致。
- 使用 `Button variant="ghost" size="icon"` 和 lucide 图标。
- 不新增大段说明文案、浮夸背景或独立附件区域。
- 系统选择器打开、取消、确认都不应清空当前草稿。
- 文件插入后，输入器不应跳转页面或打开右侧栏。
- 若系统文件选择失败，应在宿主侧以克制方式反馈错误，不影响已有草稿。

## Risks And Mitigations

### 风险：`+` 与现有技能入口图标冲突

缓解：将 `+` 归属为系统文件添加；技能手动入口更换为技能/工具类图标，同时保留 `/` 触发，降低语义冲突。

### 风险：系统文件不在工作空间内

缓解：`path` 始终保留完整路径；`relativePath` 对非工作空间文件使用稳定展示值，不把它伪装成工作空间路径。

### 风险：sender 公共 API 过度绑定 Electron

缓解：sender 只发出选择请求事件或暴露插入方法，不导入 Electron 或宿主类型。

### 风险：重复文件插入

缓解：复用现有 `editorFileKeys`，以完整 `path` 作为 key。

## Verification Focus

- 点击左下 `+` 打开系统文件选择器。
- 取消选择后草稿不变。
- 选择一个或多个文件后插入文件标签。
- 从系统选择器插入的标签与 `@` 文件面板插入的标签视觉一致。
- 重复选择同一路径不会重复插入。
- 发送 payload 包含系统选择文件的 `selectedFiles`。
- `message` 文本包含 `[文件名](文件路径)` 文件引用。
- `/` 技能触发、`@` 工作区文件触发、现有发送/停止按钮均不回退。
- `@willow/sender` 仍无 Electron 和 `app/work` 依赖。
