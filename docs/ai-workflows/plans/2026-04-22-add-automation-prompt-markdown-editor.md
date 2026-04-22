# add-automation-prompt-markdown-editor 执行计划

## 目标

依据 OpenSpec change `add-automation-prompt-markdown-editor`，新增 workspace 包 `@willow/editor-md`，导出可复用的 Tiptap Markdown 编辑器，并在 `app/work` 自动化详情页中替换现有 prompt `Textarea`。实现必须保持自动化 prompt 的持久化格式为 Markdown 文本，不输出 HTML 或 Tiptap JSON。

## 已读规格

- `docs/ai-workflows/openspec/changes/add-automation-prompt-markdown-editor/proposal.md`
- `docs/ai-workflows/openspec/changes/add-automation-prompt-markdown-editor/design.md`
- `docs/ai-workflows/openspec/changes/add-automation-prompt-markdown-editor/tasks.md`
- `docs/ai-workflows/openspec/changes/add-automation-prompt-markdown-editor/specs/automation/spec.md`

## 关键决策

- 新包路径为 `packages/editor-md`，package name 为 `@willow/editor-md`。
- 包形态参考 `@willow/sender`：`package.json` 导出 `./src/index.ts`，`vue` 作为 peer dependency，Tiptap 相关包作为 dependencies。
- 组件导出名使用 `MarkdownEditor`，页面不直接依赖包内部文件。
- Markdown 读写优先使用 `prosemirror-markdown` 作为直接依赖，避免手写完整 Markdown parser/serializer；如果实际 schema 兼容性不足，只在明确小范围内补 adapter。
- 自动化详情页仍只维护 `prompt: ref<string>`，保存、重置、校验和脏状态沿用现有逻辑。
- 不接入自动化创建弹窗，不新增工具栏、预览模式或数据库字段。

## 执行切片

### 1. 基线确认

涉及文件：

- `app/work/src/renderer/src/pages/auto/detail/AutomationDetail.vue`
- `app/work/package.json`
- `packages/sender/package.json`
- `packages/sender/tsconfig.json`
- `pnpm-lock.yaml`

步骤：

1. 确认 `AutomationDetail.vue` 当前只有 prompt `Textarea` 需要替换，`normalizedPrompt`、`isDirty`、`resetForm()`、`handleSave()` 均以 `prompt` 字符串为边界。
2. 确认 `@willow/sender` 的 package、tsconfig、Vue env 声明和导出模式，作为 `@willow/editor-md` 模板。
3. 确认 `prosemirror-markdown` 是否已在 lockfile 中出现；实现时即使已有传递依赖，也要在 `@willow/editor-md` 中直接声明。

停止条件：

- 如果详情页 prompt 不是单一字符串边界，暂停并回到 `workflow-spec` 补充数据流要求。

### 2. 新建 `@willow/editor-md` 包骨架

新增文件：

- `packages/editor-md/package.json`
- `packages/editor-md/tsconfig.json`
- `packages/editor-md/src/env.d.ts`
- `packages/editor-md/src/index.ts`

步骤：

1. 创建 `packages/editor-md`，package name 设为 `@willow/editor-md`。
2. `exports` 至少提供 `"."`，指向 `./src/index.ts`。
3. dependencies 声明：
   - `@tiptap/core`
   - `@tiptap/extensions`
   - `@tiptap/pm`
   - `@tiptap/starter-kit`
   - `@tiptap/vue-3`
   - `prosemirror-markdown`
4. peerDependencies 声明 `vue`。
5. `tsconfig.json` 参考 `packages/sender/tsconfig.json`，覆盖 `src/**/*.ts`、`src/**/*.vue`、`src/env.d.ts`。

验证点：

- `pnpm install` 后 lockfile 反映 `@willow/editor-md` 与 `app/work` workspace 关系。
- 包不引用 `app/work`、Electron、Pinia store 或自动化业务类型。

### 3. 实现 MarkdownEditor 核心组件

新增文件建议：

- `packages/editor-md/src/components/MarkdownEditor.vue`
- `packages/editor-md/src/markdown.ts`

步骤：

1. 在 `MarkdownEditor.vue` 中使用 `<script setup lang="ts">`、`useEditor`、`EditorContent` 和 `StarterKit`。
2. 使用 `@tiptap/extensions` 的 `Placeholder` 提供 placeholder。
3. Props：
   - `modelValue?: string`
   - `placeholder?: string`
   - `disabled?: boolean`
   - `autofocus?: boolean`
4. Emits：
   - `update:modelValue`
5. `markdown.ts` 提供两个明确函数：
   - `parseMarkdownToTiptapContent(markdown: string)`
   - `serializeTiptapDocToMarkdown(editorOrDoc)`
6. 用 `prosemirror-markdown` 处理 heading、paragraph、bullet list、ordered list、blockquote、fenced code block、hard break / blank line。
7. 如果 serializer 遇到不可识别节点，降级为可读文本，不能输出 HTML。
8. `onUpdate` 输出 Markdown 字符串；空编辑器输出 `""`。
9. watcher 比较外部 `modelValue` 与当前序列化 Markdown，一致时不 `setContent`，避免光标跳动。
10. `disabled` 改变时同步 `editor.setEditable(!disabled)`。
11. 组件卸载时销毁 editor。

样式要求：

- scoped 样式只覆盖 `.ProseMirror` 内容排版、placeholder、focus、disabled。
- 使用现有 CSS token，例如 `var(--color-foreground)`、`var(--color-muted-foreground)`、`var(--color-border)`。
- 不提供页面级 card、toolbar、预览栏或营销化布局。

停止条件：

- 如果 `prosemirror-markdown` 与 StarterKit schema 无法稳定解析/序列化 OpenSpec 要求的基础结构，暂停并回到 `workflow-spec` 明确是否允许新增专门 Markdown 扩展或收窄支持范围。

### 4. 导出包 API

涉及文件：

- `packages/editor-md/src/index.ts`

步骤：

1. 导出 `MarkdownEditor`。
2. 如有必要，导出组件 props 类型或 Markdown helper 类型；不要导出内部 schema 细节作为稳定 API。

验证点：

- `app/work` 只能从 `@willow/editor-md` 引入，不从 `packages/editor-md/src/...` 引入。

### 5. 接入自动化详情页

涉及文件：

- `app/work/package.json`
- `app/work/src/renderer/src/pages/auto/detail/AutomationDetail.vue`

步骤：

1. 在 `app/work/package.json` dependencies 中新增 `"@willow/editor-md": "workspace:*"`。
2. 移除 `Textarea` import。
3. 引入 `MarkdownEditor`。
4. 用 `<MarkdownEditor v-model="prompt" placeholder="输入自动化执行时要发送给 AI 的提示词" />` 替换当前 prompt `Textarea`。
5. 保留现有外层滚动容器、主内容宽度和保存按钮逻辑。
6. 如需传 class，优先让组件接收普通 `class` 透传；不要在页面里深度改包内部实现。

验证点：

- `normalizedPrompt` 仍基于 Markdown 字符串 trim。
- `isDirty` 仍比较 Markdown 字符串与 `automation.prompt`。
- `resetForm()` 后编辑器恢复服务端当前值。
- 保存失败时当前编辑内容仍保留。

### 6. 依赖安装与静态检查

命令：

- `pnpm install`
- `cd app/work && pnpm lint`
- `pnpm lint`

说明：

- `pnpm install` 需要在新增 workspace 依赖后运行，确保 lockfile 与 workspace link 更新。
- `pnpm lint` 是最终全局 lint；如果时间或环境受限，至少运行 `cd app/work && pnpm lint` 并记录未运行项。

停止条件：

- 如果 `pnpm install` 因网络或 sandbox 失败，按工具权限规则请求提升后重试。
- 如果 lint 暴露与本变更无关的既有问题，只记录并避免顺手修 unrelated 文件。

### 7. 构建与手动验证

命令：

- `pnpm build`
- 必要时启动 `pnpm dev` 做手动 UI 验证。

手动验证清单：

- 打开自动化详情页，prompt 区域不再是 `Textarea`。
- 输入 `# ` 后转换为一级标题。
- 输入 `## `、`- `、`1. `、`> `、`` ``` `` 时转换为对应结构。
- 已保存 Markdown 再次打开时渲染为标题、列表、引用、代码块。
- 点击保存后，提交的 `automation.prompt` 仍为 Markdown 文本，不含 HTML 或 Tiptap JSON。
- 点击重置后，编辑器恢复当前自动化服务端值。
- 保存失败时，编辑器保留用户未提交内容。

## 风险与缓解

- Markdown parser/serializer 与 Tiptap schema 不一致：优先用 `prosemirror-markdown`，必要时为 StarterKit 节点做小 adapter；如果基础结构仍不稳定，停止并回规格阶段。
- 光标跳动：所有外部同步都先比较当前 Markdown 输出，只有不一致时才 `setContent`。
- 包样式侵入 app：编辑器包只提供内容排版，不承担页面布局。
- Tiptap 依赖重复：新包直接声明所需依赖，pnpm 负责去重；实现后通过 install 和 lint/build 验证解析结果。

## 完成条件

- OpenSpec tasks 中 1.x 到 4.x 均可对应到实现与验证记录。
- `packages/editor-md` 可作为 `@willow/editor-md` 被 `app/work` 引用。
- 自动化详情页使用 `MarkdownEditor` 替代 prompt `Textarea`。
- 保存链路仍写入 Markdown 字符串。
- 相关 lint/build 或明确记录的替代验证完成。

## 下一步

进入 `workflow-implement`，按本计划从包骨架开始实现。
