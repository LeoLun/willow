# Proposal: add-sender-system-file-picker

## Background

`@willow/sender` 已支持通过 `@` 在聊天输入器中选择工作空间文件，并将文件插入为 Tiptap 文件标签；发送时 `message` 会包含 `[文件名](文件路径)` 形式的 Markdown 文件引用，`selectedFiles` 会携带结构化文件引用。

当前输入器左下工具栏已有技能入口和工作区文件入口，但用户希望在输入框左下角新增一个 `+` 按钮：点击后直接拉起系统文件选择器，选择文件后效果与 `@` 添加文件一致。该入口应服务“从系统任意位置选文件并加入当前消息上下文”的动作，而不是再次打开工作区文件搜索面板。

根据根目录 `DESIGN.md`，该入口应保持桌面工作台式的紧凑工具按钮，不新增大段说明或独立页面。

## Goals

- 在聊天输入框左下角提供一个 `+` 图标按钮。
- 点击 `+` 后通过 Electron 系统文件选择器选择一个或多个文件。
- 用户确认选择后，所选文件以现有文件标签形式插入当前 sender 草稿。
- 插入后的消息文本、文件标签视觉、发送 payload `selectedFiles` 与 `@` 工作区文件添加效果一致。
- 保持 `@willow/sender` 共享包边界：系统文件选择器由宿主 `app/work` 提供，sender 不直接调用 Electron IPC。
- 系统选择文件不要求文件必须位于当前工作空间内；但若文件位于当前工作空间内，应尽量保留工作空间相对路径。

## Non-Goals

- 本次不实现文件内容上传、读取、向模型自动注入文件内容或大文件校验。
- 本次不改变 `@` 工作区文件搜索面板的行为。
- 本次不移除通过 `/` 触发技能或通过 `@` 触发文件的键盘能力。
- 本次不新增拖拽上传、粘贴文件、文件预览或附件管理面板。
- 本次不处理目录选择；系统选择器只选择文件。

## User Experience

用户在聊天输入框左下角点击 `+` 按钮后，系统文件选择器打开。用户可以选择一个或多个文件并确认。确认后，sender 将每个文件插入为与 `@` 添加文件相同的文件标签，编辑器继续聚焦，用户可以继续输入正文、添加技能或发送消息。

如果用户取消选择，输入器不发生变化。如果用户选择了已经在当前草稿中存在的文件，sender 不重复插入该文件。发送消息时，这些系统选择文件应出现在 `selectedFiles` 中，并且 `message` 中仍输出 `[文件名](文件路径)` 的文件引用文本。

## Approaches

### Approach A: 在 `@willow/sender` 内直接创建隐藏 `<input type="file">`

sender 自己渲染隐藏文件输入框，点击 `+` 后触发浏览器文件选择。

优点：

- 改动集中在 sender 包内。
- 不需要新增 IPC。

缺点：

- Electron renderer 的 Web File API 通常不能稳定提供宿主需要的完整本地路径。
- sender 共享包会承担本地桌面文件选择语义，边界变差。
- 难以与现有 `app/work` 文件路径、工作空间相对路径和主进程权限模型保持一致。

### Approach B: 由 `app/work` 提供系统文件选择 API，sender 只暴露选择请求事件

`@willow/sender` 在 `+` 按钮点击时发出 `select-files` 事件；`app/work` 的 `SenderContainer` 调用 Electron IPC 拉起 `dialog.showOpenDialog({ properties: ["openFile", "multiSelections"] })`，把结果映射为 `SenderFileOption` 后再传回 sender 插入文件标签。

优点：

- 符合现有共享包边界：桌面系统能力留在宿主。
- 可复用现有 `FileTag`、`insertFileTag()`、重复文件去重和 `selectedFiles` 发送逻辑。
- 能稳定取得完整文件路径，并可基于当前 workspace root 计算 `relativePath`。

缺点：

- 需要扩展 sender 公共事件/API。
- 需要新增或扩展 app/work 的 dialog IPC、preload 类型和 renderer 适配。

### Approach C: 点击 `+` 仅打开现有 `@` 文件面板

把 `+` 当作工作区文件面板的手动入口，不调用系统选择器。

优点：

- 改动最小。
- 复用现有文件面板。

缺点：

- 不满足“拉起系统文件选择器”的核心需求。
- 只能选择当前工作空间已扫描文件，无法从系统其他位置添加文件。

## Recommendation

推荐 Approach B。

该需求明确涉及系统文件选择器，属于 Electron 宿主能力；而“选择后效果一致”应通过 sender 暴露受控插入文件标签能力来实现。这样可以不破坏 `@willow/sender` 的共享包职责，同时最大化复用现有 `@` 文件标签和发送 payload 逻辑。

## Success Criteria

- 输入框左下角存在一个紧凑的 `+` 图标按钮，符合 `DESIGN.md` 的工具栏按钮规范。
- 点击 `+` 会打开系统文件选择器，而不是现有工作区文件搜索面板。
- 支持选择多个文件；取消选择时草稿不变。
- 选择文件后，文件以现有文件标签插入编辑器，视觉和 `@` 添加文件一致。
- 选择文件后，编辑器保持可继续输入的状态。
- 重复选择同一路径文件不会插入重复标签。
- 发送消息时，系统选择的文件出现在 `selectedFiles`，并且 `message` 文本包含对应 `[文件名](文件路径)` 引用。
- `@` 工作区文件选择和 `/` 技能选择的触发、键盘导航、发送行为不回退。
- `@willow/sender` 不直接导入 Electron、`app/work`、Pinia 或 Vue Router。
