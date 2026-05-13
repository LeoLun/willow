# Design: add-automation-prompt-markdown-editor

## Overview

本变更新增独立 workspace 包 `@willow/editor-md`，并用它升级自动化详情页的 prompt 编辑体验。现有详情页已经承担“查看 + 编辑 + 保存”的工作台职责，本次在主内容区将普通 `Textarea` 替换为该包导出的 Tiptap Markdown 编辑器，使 prompt 可以按 Markdown 结构编辑和阅读。

关键边界：

- UI 层使用 Tiptap document 表达富文本编辑状态。
- 持久化和运行时层仍使用 Markdown 文本。
- `AutomationDetail.vue` 的保存、重置、校验、脏状态和 toast 反馈语义保持不变。
- 编辑器实现位于 `packages/editor-md`，`app/work` 只消费包 API。

## Package Shape

新增包：

- 路径：`packages/editor-md`
- package name：`@willow/editor-md`
- 入口：`packages/editor-md/src/index.ts`
- 组件：建议导出 `MarkdownEditor`，如需自动化语义包装，可在 `app/work` 再命名为业务组件。
- 样式入口：如组件样式不能完全 scoped，提供 `@willow/editor-md/style.css` 或在组件内 scoped 处理；实现阶段应优先减少 app 侧样式负担。

包依赖策略：

- `vue` 作为 peer dependency，跟随其他 Willow UI 包形态。
- Tiptap 相关依赖放在 `@willow/editor-md` 的 dependencies 中，包括 `@tiptap/core`、`@tiptap/pm`、`@tiptap/starter-kit`、`@tiptap/vue-3`，以及实现确实需要的 Tiptap 官方扩展。
- `app/work` 通过 `workspace:*` 依赖 `@willow/editor-md`。

组件 API：

- `modelValue: string`
- `placeholder?: string`
- `disabled?: boolean`
- 可选 `autofocus?: boolean`
- 事件：`update:modelValue`
- 组件内部负责创建和销毁 Tiptap editor。

详情页替换方式：

- 移除 `Textarea` import。
- 从 `@willow/editor-md` 引入 `MarkdownEditor`，使用 `<MarkdownEditor v-model="prompt" />` 替代当前 prompt `Textarea`。
- 外层布局仍保留当前主内容滚动容器与宽度约束，避免编辑器引入额外页面外壳。

## Markdown Boundary

### Loading

编辑器加载 `modelValue` 时，应把 Markdown 文本解析为 Tiptap 可渲染内容。实现可以使用轻量的本地转换逻辑或 Tiptap 兼容能力，但必须覆盖本变更要求的基础块级结构：

- heading: `#` 到 `######`
- paragraph
- bullet list
- ordered list
- blockquote
- fenced code block
- hard break / blank line

若实现阶段发现完整 Markdown 解析需要新增依赖，必须优先评估是否已有仓库依赖可复用；新增依赖应落在 `@willow/editor-md` 包内，并在计划中明确说明原因。

### Editing

编辑器应启用 Markdown 风格的输入规则，使用户键入常见前缀后自动转换结构：

- `# ` 转一级标题
- `## ` 到 `###### ` 转对应级别标题
- `- ` 或 `* ` 转无序列表
- `1. ` 转有序列表
- `> ` 转引用
- `` ``` `` 转代码块

`@tiptap/starter-kit` 已覆盖大部分基础节点和输入规则，除非它与保存语义冲突，否则应优先使用 StarterKit。

### Saving

编辑器内容变化时必须输出 Markdown 文本，而不是 HTML、纯 `getText()` 或 Tiptap JSON。

输出 Markdown 至少要稳定保留：

- 标题层级
- 段落间空行
- 无序和有序列表项目
- 引用前缀
- 围栏代码块
- 行内基本标记在可行时保留，例如 bold、italic、code

如果某些 Tiptap 节点暂时无法无损序列化，应在组件内降级为可读纯文本，且不能输出 HTML 标签。

## Synchronization Rules

- 当父组件传入的 `modelValue` 与编辑器当前 Markdown 输出一致时，不应重复 `setContent`，避免光标跳动。
- 当 `resetForm()` 改变 `prompt` 时，编辑器必须同步回服务端当前 Markdown。
- 当 `loadAutomation()` 切换到另一条自动化时，编辑器必须展示新自动化的 prompt。
- 保存失败时，父组件中的 `prompt` 不会被回滚，编辑器应保持用户未提交内容。
- 组件卸载时必须释放 editor，避免详情页切换后残留监听。

## Visual And Interaction Rules

`@willow/editor-md` 应保持低样式侵入：包内只提供编辑器内容所需的基础排版、placeholder、focus 和禁用态样式，不创建页面级容器语义。自动化详情页接入时仍遵守根目录 `DESIGN.md` 的 renderer 工作台约束：

- 编辑器外观应贴近当前无边框正文编辑区，而不是厚重文档编辑器或独立卡片。
- 使用现有 token：`background`、`foreground`、`muted-foreground`、`border` 等，不新增平行主题变量。
- 编辑器 focus 态应清晰但克制，可沿用透明背景与无边框语义。
- 内容排版要适合 prompt 编辑：标题、列表、引用、代码块有清晰层级，但整体仍保持页面密度。
- placeholder 使用弱化文字，不占用额外说明区。
- 不新增可见工具栏，除非后续规格明确要求。

## Package Integration Rules

- `packages/editor-md` 应提供自己的 `package.json`、`tsconfig.json`、`src/index.ts` 和必要的 Vue env 声明，形态可参考 `@willow/sender`。
- `app/work/package.json` 需要新增 `@willow/editor-md: workspace:*`。
- 不应让 `app/work` 直接依赖编辑器内部文件路径。
- 不应把自动化业务类型、store、router 或 Electron API 引入 `@willow/editor-md`。
- 如果后续其他包复用该编辑器，应通过公开导出 API，而不是复制组件源码。

## Validation And Empty State

- 详情页现有 `normalizedPrompt = prompt.trim()` 仍作为必填校验依据。
- 空编辑器输出应为 `""`，不可输出空段落 HTML 或占位文本。
- 保存按钮禁用逻辑继续由 `isValid`、`isDirty` 和 `isSaving` 控制。

## Risks

- Markdown 解析/序列化如果手写过多，容易出现边界不一致。实现时应优先小范围覆盖本需求明确的 Markdown 子集。
- Tiptap 内容同步如果未做相等判断，可能导致输入时光标跳动。
- StarterKit 默认启用的节点可能超出当前 Markdown 序列化能力，实现阶段需要确认支持范围与输出规则一致。
- 新增包可能造成 Tiptap 依赖在 `app/work` 和 `@willow/editor-md` 间重复声明；实现阶段应确认 pnpm workspace 解析与构建不会产生冲突。
