# Design: add-sender-file-mention

## Overview

本次变更在 `@willow/sender` 中新增 `@` 文件引用选择能力。设计目标是让文件引用成为与 `/` 技能选择同级的输入器交互：同一套触发检测、弹层位置、键盘导航和标签插入模型，不把 Electron 或工作空间读取逻辑带入共享包。

根据 [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md)，输入器仍应保持桌面工作台表面：紧凑、稳定、低装饰，不新增营销式说明，也不引入独立主题。

## Current State

`@willow/sender` 当前已有：

- `useTriggerManager()`：识别触发字符、查询文本、触发文本范围、手动面板、active index。
- `Sender.vue`：注册 `/` 触发器，控制 `SkillPickerPanel`，处理键盘选择与插入技能标签。
- `Editor.vue`：基于 Tiptap，支持 `SkillTag` inline atom，并暴露 `insertSkillTag()` 与 `getSkillTags()`。
- `SenderSendPayload`：包含 `message`、`selectedSkills`、`modelId`、`webSearchEnabled`。

`app/work` 当前已有：

- `useWorkspaceFiles(workspaceId)`：读取当前工作空间文件树、loading、error、rootPath。
- `WorkspaceFileNode`：包含 `name`、`path`、`type`、`size`、`extension`、`children`。
- `SenderContainer.vue`：作为宿主适配层注入模型、技能、loading/error 和路由行为。

`@willow/ui` 当前已有：

- `MarkdownBlock.vue`：负责用户消息、助手消息中的 Markdown 渲染。
- `SkillTag.vue`：用于展示 `[$skillname](skill/xxx.md)` 这类技能引用。
- `MarkdownBlock.vue` 内已有 `skillTag` marked inline extension，会把技能引用解析为 `.willow-skill-tag` 占位，再挂载 Vue 组件。
- `MarkdownBlock.vue` 中已有文件标签 TODO，说明文件引用应按不同正则与文件图标渲染。

## Public API Changes

### New Shared Types

`packages/sender/src/types.ts` 应新增宿主无关的文件视图类型：

```ts
export interface SenderFileOption {
  name: string;
  path: string;
  relativePath: string;
  extension?: string;
  size?: number;
}

export interface SenderFileReference {
  name: string;
  path: string;
  relativePath: string;
  extension?: string;
}
```

其中：

- `path` 是宿主可识别的完整文件路径。
- `relativePath` 是相对于当前工作空间根目录的展示与查询路径。
- 只允许 `type === "file"` 的节点转换为 `SenderFileOption`。

### Sender Props

`Sender` 新增 props：

- `files?: SenderFileOption[]`
- `filesLoading?: boolean`
- `filesErrorMessage?: string`

这些数据由宿主传入。`@willow/sender` 不主动读取工作空间文件，不知道 `workspaceId`，也不调用 IPC。

### Sender Send Payload

`SenderSendPayload` 新增：

- `selectedFiles?: SenderFileReference[]`

发送时，payload 同时携带正文、已选技能、已选文件、模型和联网开关。其中 `message` 文本中的文件引用必须使用 Markdown 链接格式 `[文件名.后缀](文件地址)`，例如 `[app.ts](/user/xxxx/app.ts)`；结构化 `selectedFiles` 用于宿主稳定识别引用，不替代文本格式要求。

## Trigger Model

`Sender.vue` 应把 `useTriggerManager` 从只注册 `/` 扩展为注册：

- `/`：技能选择，pattern 保持现有语义。
- `@`：文件选择，pattern 建议匹配当前光标前最后一个不含空白的 `@query`。

触发器行为：

- 输入 `@` 打开文件面板。
- 输入 `@foo` 后以 `foo` 过滤文件名与相对路径。
- 手动点击文件入口时，打开 `@` 对应的文件面板，查询为空。
- Escape 关闭面板。
- ArrowUp / ArrowDown 在当前面板结果中移动 active index。
- Enter 选择当前 active item，并阻止默认换行或发送。

如果同时存在多个触发字符，只根据 `activeTriggerChar` 渲染对应面板。

## File Picker Panel

新增 `FilePickerPanel.vue` 或等价内部组件，职责与 `SkillPickerPanel.vue` 对齐：

- 接收 `files`、`filesLoading`、`filesErrorMessage`、`query`、`activeIndex`、`selectedFileKeys`、`isSearchMode`。
- 根据文件 `name` 与 `relativePath` 过滤结果。
- 展示文件图标、文件名、相对路径和扩展名。
- 对已选文件降透明或显示已选择状态，避免重复选择。
- 暴露 `filteredFiles`，供键盘 Enter 选择 active item。

空态与错误态文案应短而明确：

- 加载中：`正在加载文件...`
- 无文件：`当前工作空间没有可引用的文件。`
- 查询无结果：`没有匹配 @query 的文件。`
- 错误：展示宿主传入的 `filesErrorMessage`。

## File Tag

新增 `FileTag` Tiptap inline atom，与 `SkillTag` 平行：

- 属性：`name`、`path`、`relativePath`、`extension`。
- NodeView 使用紧凑标签显示，建议图标使用 `FileTextIcon` 或按扩展名映射轻量图标。
- `renderText()` 必须输出 `[文件名.后缀](文件地址)`，例如 `[app.ts](/user/xxxx/app.ts)`。
- 文件标签处理应参考现有 `SkillTag` 的 `renderText()`、NodeView 和 attributes 提取方式；技能标签当前输出形态为 `[$skillname](skill/xxx.md)`。
- 结构化 payload 仍应来自 tag attributes，不通过解析 Markdown 文本反推文件引用。

`Editor.vue` 应新增：

- `insertFileTag(attrs)`
- `getFileTags()`

发送器内部维护 `editorFileKeys`，key 建议使用文件绝对路径或 `path`，避免同名文件冲突。

## Message Rendering In @willow/ui

`@willow/ui` 的 `MarkdownBlock.vue` 应支持文件引用消息格式渲染，处理方式参考现有技能引用渲染：

- 技能引用格式继续为 `[$skillname](skill/xxx.md)`，仍渲染为 `SkillTag`。
- 文件引用格式为 `[文件名.后缀](文件地址)`，例如 `[app.ts](/user/xxxx/app.ts)`。
- 文件引用不带 `$` 前缀，解析规则应避免抢占技能引用。
- 文件引用应渲染为紧凑的文件标签组件，例如 `FileTag` 或等价内部组件，展示文件图标与文件名，并保留完整路径作为 title 或等价可访问信息。
- 普通 Markdown 链接必须继续由原有 link renderer 渲染为外链；只有符合文件引用特征的链接才转为文件标签。

文件引用识别建议以“链接文本包含文件扩展名，且 href 为本地路径或相对路径”为基础。不要把 `https://`、`http://`、`mailto:` 等普通链接误渲染为文件标签。

## Send Behavior

发送时：

- 继续要求已有模型配置与非空正文。
- `message` 仍来自 Tiptap `getText().trim()`，其中 FileTag 的文本表示必须是 `[文件名.后缀](文件地址)`。
- `selectedSkills` 从编辑器中的技能标签读取，而不是只依赖本地 Set。
- `selectedFiles` 从编辑器中的文件标签读取。
- 发送成功后清空编辑器草稿，技能标签与文件标签都被清空。

如果用户仅选择了文件但没有正文，本次规格默认不允许发送，保持当前“正文为空不可发送”的行为。后续如要支持“只发文件引用”，应单独更新 OpenSpec。

## Host Integration

`app/work/src/renderer/src/pages/chat/components/SenderContainer.vue` 负责：

- 根据 `workspaceId` 调用 `useWorkspaceFiles()` 或等价逻辑获取文件树。
- 将 `WorkspaceFileNode[]` 扁平化为 `SenderFileOption[]`。
- 只传入文件节点，不传文件夹节点。
- 计算相对路径时使用主进程返回的 `rootPath`，避免共享包理解工作空间路径。
- 将 `filesLoading`、`filesErrorMessage` 传给 `Sender`。

宿主消息类型 `SendMessage` 如当前不包含文件引用，需要在 `app/work` 的共享 API 中扩展对应字段，字段语义应与 `SenderFileReference` 对齐。

## Visual And Interaction Constraints

- 文件入口应位于发送器底部工具栏，与技能 `PlusIcon`、联网开关、模型选择保持同一层级。
- 使用 lucide 文件类图标，不用文本按钮解释功能。
- 面板位置、圆角、边框、阴影、密度与 `SkillPickerPanel` 保持一致。
- 不新增大段说明文案；状态文案只说明当前情况。
- 文件名与路径必须截断，不能撑开输入器或面板。
- `@willow/ui` 中的文件引用标签应与 `SkillTag` 同等紧凑，不应渲染成普通蓝色长链接，也不能撑开消息内容宽度。

## Risks And Mitigations

### 风险：大工作空间文件过多导致面板卡顿

缓解：本次先复用现有工作空间文件读取结果，并在面板中限制最大显示高度。若实现阶段发现明显性能问题，再回到 OpenSpec 追加“异步搜索/分页/限制数量”要求。

### 风险：`@` 与邮箱、路径文本误触发

缓解：触发 pattern 仅匹配当前光标前最后一段非空白 token，Escape 可关闭。若后续常见误触发影响使用，再追加更严格的上下文规则。

### 风险：标签文本与结构化 payload 不一致

缓解：文件标签 `renderText()` 负责生成 `[文件名.后缀](文件地址)`；发送时以编辑器 doc 中的 tag attributes 生成 `selectedFiles`，不要通过解析 `message` 文本反推文件引用。

## Verification Focus

- 输入 `@`、`@partial` 可打开并过滤文件面板。
- 手动文件入口可打开文件面板。
- ArrowUp / ArrowDown / Enter / Escape 对文件面板生效，并不破坏 `/` 面板。
- 文件标签可插入、和技能标签共存、发送后清空。
- `message` 中的文件标签文本为 `[文件名.后缀](文件地址)`，例如 `[app.ts](/user/xxxx/app.ts)`。
- `@willow/ui` 的 `MarkdownBlock` 能把 `[app.ts](/user/xxxx/app.ts)` 渲染为文件标签，并继续把 `[$skillname](skill/xxx.md)` 渲染为技能标签。
- `send` payload 包含 `selectedFiles`。
- 无工作空间文件、加载中、加载失败均有稳定状态。
- `@willow/sender` 仍无 app/work 反向依赖。
