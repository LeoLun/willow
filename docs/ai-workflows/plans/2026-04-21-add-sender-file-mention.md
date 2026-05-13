# add-sender-file-mention 实施计划

## Summary

实现 `@willow/sender` 的 `@` 文件引用选择能力：复用 `/` 技能选择的触发、弹层、键盘导航和标签插入模式；文件标签在 `message` 文本中输出 `[文件名.后缀](文件地址)`，并在 payload 中提供结构化 `selectedFiles`。追加实现 `@willow/ui` 对该消息格式的渲染，让 `[app.ts](/user/xxxx/app.ts)` 像 `[$skillname](skill/xxx.md)` 一样显示为紧凑标签。

## Key Changes

- 在 `packages/sender` 增加 `SenderFileOption`、`SenderFileReference`，并扩展 `SenderSendPayload.selectedFiles?: SenderFileReference[]`；`Sender` 新增 `files`、`filesLoading`、`filesErrorMessage` props。
- 新增 `FileTag` Tiptap inline atom 和 `FileTagView`，按现有 `SkillTag` 模式实现 attributes、NodeView、`renderText()`；`renderText()` 必须输出 `[name](path)`，例如 `[app.ts](/user/xxxx/app.ts)`。
- 扩展 `Editor.vue`：注册 `FileTag`，暴露 `insertFileTag()`、`getFileTags()`；发送时从 editor doc 读取技能标签和文件标签，不能解析 Markdown 文本反推引用。
- 扩展 `Sender.vue`：注册 `/` 与 `@` 两个 trigger；根据 `activeTriggerChar` 分别渲染 `SkillPickerPanel` 或新增 `FilePickerPanel`；键盘 ArrowUp、ArrowDown、Enter、Escape 对当前面板生效。
- 新增 `FilePickerPanel`：按文件名和 `relativePath` 过滤，展示加载、错误、空列表、无匹配状态；面板视觉密度、位置、边框和阴影对齐 `SkillPickerPanel`。
- 在 `app/work` 扩展共享 API：新增 `FileReference` 或等价类型，并为 `SendMessageRequest` / `SendMessage` 增加 `selectedFiles?: FileReference[]`；保留现有 `files?: IFile[]`，不在本次迁移或删除。
- 在 `SenderContainer.vue` 使用现有 `useWorkspaceFiles(workspaceId)` 加载文件树，扁平化 `type === "file"` 节点为 sender file options；基于 `rootPath` 计算 `relativePath`；将 `selectedFiles` 透传到 `Chat.vue` 和 `electronAPI.sendMessage`。
- 更新 `app/ui-playground` Sender demo：增加 mock files，传入 `files`，事件摘要和 payload 展示包含 `selectedFiles`，用于无 Electron 环境验证共享包能力。
- 在 `@willow/ui` 的 `MarkdownBlock.vue` 增加文件引用 inline extension，识别 `[文件名.后缀](文件地址)` 并渲染为文件标签；普通 `https://`、`http://`、`mailto:` 链接继续走原有外链渲染。
- 新增 `packages/ui/src/components/FileTag.vue` 或等价内部组件，参考 `SkillTag.vue` 的挂载方式，展示文件图标、文件名，并用 `title` 或等价属性保留完整路径。
- 更新 `app/ui-playground` 的 Markdown 或消息 demo，加入文件引用、技能引用和普通链接共存样例，便于手动确认渲染边界。
- 不修改主进程文件读取、文件内容注入或工具调用逻辑；`SessionService.buildPromptInput()` 继续使用 `message` 文本，文件上下文只以 Markdown 引用和 `selectedFiles` 结构化字段随请求传递。

## Execution Slices

- Slice 1: 类型与协议边界  
  先改 `packages/sender/src/types.ts`、`packages/sender/src/index.ts` 和 `app/work/src/shared/api.ts`，确保 sender payload 与 app send request 的类型边界清晰。
- Slice 2: 编辑器标签能力  
  实现 `FileTag`、`FileTagView`、`Editor.vue` 暴露方法，并确认 `getText()` 能输出 `[name](path)`。
- Slice 3: 文件选择交互  
  实现 `FilePickerPanel` 和 `Sender.vue` 的 `@` trigger、toolbar 文件入口、键盘选择、去重、发送后清空。
- Slice 4: 宿主接入与 demo  
  在 `SenderContainer.vue` 接入工作空间文件；更新 `app/ui-playground` mock 和 Sender demo；确认 `/` 技能选择未回退。
- Slice 5: 验证与收口  
  运行相关检查，修正类型、lint、构建问题；如发现只选文件但无正文必须发送等新需求，停止实现并回到 `workflow-spec`。
- Slice 6: `@willow/ui` 文件引用消息渲染  
  在 `MarkdownBlock.vue` 中添加文件引用解析，复用现有 `.willow-skill-tag` 的占位挂载模式新增 `.willow-file-tag`；新增 `FileTag.vue`；更新 playground Markdown/消息样例。
- Slice 7: UI 渲染回归验证  
  验证 `[app.ts](/user/xxxx/app.ts)` 渲染为文件标签，`[$workflow-spec](skill/workflow-spec.md)` 仍渲染为技能标签，`[OpenAI](https://openai.com)` 仍渲染为普通链接。

## Test Plan

- 手动验证 sender：输入 `@` 打开文件面板，输入 `@app` 按文件名或相对路径过滤，ArrowUp/ArrowDown/Enter/Escape 行为正确。
- 手动验证标签：选择 `/` 技能和 `@` 文件后，普通文本、技能标签、文件标签可共存；重复选择同一路径不插入重复文件标签。
- 手动验证 payload：发送后 `message` 包含 `[app.ts](/user/xxxx/app.ts)`，payload 包含 `selectedFiles` 的 `name`、`path`、`relativePath`、`extension`。
- 手动验证状态：无文件、加载中、加载失败、无匹配结果均显示简短状态，且普通文本发送不受影响。
- 回归验证：`/` 技能选择、模型选择、联网开关、usage、发送/停止行为保持可用。
- `@willow/ui` 渲染验证：同一段 Markdown 中放入 `[app.ts](/user/xxxx/app.ts)`、`[$workflow-spec](skill/workflow-spec.md)`、`[OpenAI](https://openai.com)`，确认三者分别渲染为文件标签、技能标签、普通链接。
- 边界验证：`https://example.com/app.ts` 不渲染为文件标签；`skill/*.md` 的技能链接仍由技能解析优先处理。
- 命令验证：实现后运行 `pnpm lint`；因修改共享包和 app 类型，运行 `pnpm build`。

## Assumptions

- 文件引用只选择文件，不选择文件夹。
- 只选择文件但没有正文仍不可发送，保持现有空正文禁发行为。
- 本次不读取文件内容、不上传文件、不把文件内容注入模型上下文。
- `selectedFiles` 是结构化识别来源；`message` 中的 Markdown 链接是用户和模型可见的文本格式。
- `@willow/ui` 文件标签只负责消息格式展示，不触发打开文件、读取文件或安全敏感操作。
- 文件链接识别默认排除 `http://`、`https://`、`mailto:` 等外部协议，只处理本地绝对路径或相对路径。
