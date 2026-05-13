# Tasks: add-sender-file-mention

## 1. 公共 API 与类型

- [x] 1.1 在 `packages/sender/src/types.ts` 中新增 `SenderFileOption` 和 `SenderFileReference`。
- [x] 1.2 为 `SenderSendPayload` 增加可选 `selectedFiles` 字段。
- [x] 1.3 为 `Sender` props 增加文件选项、加载状态和错误信息。
- [x] 1.4 如果 `app/work` 的发送请求类型尚不支持结构化文件引用，则扩展对应类型。

## 2. 发送器触发器与编辑器标签

- [x] 2.1 在 `Sender.vue` 中使用现有 trigger manager 注册 `@`。
- [x] 2.2 新增 Tiptap `FileTag` inline atom，并包含稳定属性。
- [x] 2.3 让 `FileTag.renderText()` 输出 `[文件名.后缀](文件地址)`，例如 `[app.ts](/user/xxxx/app.ts)`。
- [x] 2.4 参考现有技能标签 `[$skillname](skill/xxx.md)` 的处理方式实现文件标签渲染、NodeView 和 attributes 提取。
- [x] 2.5 在 `Editor.vue` 中新增 `insertFileTag()` 和 `getFileTags()`。
- [x] 2.6 从编辑器内容中追踪已选文件 key，并阻止重复选择。
- [x] 2.7 确保发送 payload 从编辑器标签属性构建，而不是解析消息文本。

## 3. 文件选择 UI

- [x] 3.1 新增 `FilePickerPanel.vue` 或等价内部组件。
- [x] 3.2 匹配 `/` 选择器的位置、密度、边框、阴影和键盘语义。
- [x] 3.3 支持按文件名和工作空间相对路径过滤。
- [x] 3.4 渲染加载中、错误、空列表和无匹配结果状态。
- [x] 3.5 增加一个紧凑的工具栏控件，用于手动打开文件选择器。

## 4. app/work 宿主集成

- [x] 4.1 在 `SenderContainer.vue` 中通过现有宿主 API 或 composable 加载工作空间文件。
- [x] 4.2 将 `WorkspaceFileNode[]` 扁平化为仅包含文件的 sender options。
- [x] 4.3 基于 `rootPath` 计算并传入工作空间相对路径。
- [x] 4.4 将文件加载状态和错误状态传入 `Sender`。
- [x] 4.5 将 `selectedFiles` 接入聊天发送链路，且不依赖文本解析。

## 5. 验证

- [x] 5.1 验证输入 `@` 可打开并过滤文件选择器。
- [x] 5.2 验证工具栏文件控件可打开同一个选择器。
- [x] 5.3 验证 ArrowUp、ArrowDown、Enter、Escape 对 `@` 和 `/` 面板都正常。
- [x] 5.4 验证文件标签、技能标签和普通文本可以共存。
- [x] 5.5 验证 `message` 中的文件引用格式为 `[文件名.后缀](文件地址)`。
- [x] 5.6 验证发送 payload 包含 `selectedFiles`，并在发送后清空编辑器状态。
- [x] 5.7 实现阶段对触及的 TypeScript/Vue 代码运行 `pnpm lint`。
- [x] 5.8 如果修改共享包或 app 发送类型，运行 `pnpm build`。

## 6. @willow/ui 消息格式渲染

- [x] 6.1 在 `packages/ui/src/components/MarkdownBlock.vue` 中新增文件引用 inline extension，识别 `[文件名.后缀](文件地址)`。
- [x] 6.2 新增 `FileTag` 或等价内部组件，参考 `SkillTag` 以紧凑标签显示文件图标、文件名和完整路径 metadata。
- [x] 6.3 确保文件引用解析不拦截 `[$skillname](skill/xxx.md)` 技能标签。
- [x] 6.4 确保 `https://`、`http://`、`mailto:` 等普通 Markdown 链接继续按原有外链方式渲染。
- [x] 6.5 在 `app/ui-playground` 的 Markdown 或消息 demo 中加入文件引用、技能引用和普通链接共存样例。
- [x] 6.6 验证 `@willow/ui` 渲染 `[app.ts](/user/xxxx/app.ts)` 为文件标签，渲染 `[$workflow-spec](skill/workflow-spec.md)` 为技能标签，渲染 `[OpenAI](https://openai.com)` 为普通链接。
