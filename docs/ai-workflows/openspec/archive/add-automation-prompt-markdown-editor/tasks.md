## 1. 现状确认

- [x] 1.1 确认 `app/work` 当前 Tiptap 依赖可直接用于 renderer。
- [x] 1.2 确认 `AutomationDetail.vue` 的 `prompt` 保存、重置、脏状态和校验逻辑边界。
- [x] 1.3 对照 `DESIGN.md` 确认编辑器需要继承当前详情页主内容区视觉密度。
- [x] 1.4 确认 `packages/` 下现有包结构，确定 `@willow/editor-md` 的 package、tsconfig、导出和样式入口形态。

## 2. `@willow/editor-md` 包

- [x] 2.1 新增 `packages/editor-md`，配置 package name `@willow/editor-md`、`src/index.ts`、`tsconfig.json` 和必要的 Vue env 声明。
- [x] 2.2 在 `@willow/editor-md` 中新增 `MarkdownEditor` 组件，封装 `@tiptap/vue-3`、`StarterKit`、placeholder、禁用态和基础样式。
- [x] 2.3 实现 Markdown 文本加载到 Tiptap 内容的转换，覆盖标题、段落、列表、引用和代码块。
- [x] 2.4 实现 Tiptap 内容输出为 Markdown 文本，保存给父组件的 `v-model`。
- [x] 2.5 处理父组件外部更新、自动化切换、重置和组件卸载，避免光标跳动或 editor 泄漏。
- [x] 2.6 确保包不依赖 `app/work` 的业务类型、store、router 或 Electron API。

## 3. 详情页接入

- [x] 3.1 在 `app/work/package.json` 中新增 `@willow/editor-md: workspace:*`。
- [x] 3.2 在 `AutomationDetail.vue` 中移除 prompt `Textarea`，接入 `@willow/editor-md` 的 `MarkdownEditor`。
- [x] 3.3 保持现有保存、重置、校验、保存成功和保存失败交互不变。
- [x] 3.4 保持主内容区滚动、宽度和无边框编辑视觉，不新增多余页面外壳或工具栏。

## 4. 验证

- [x] 4.1 手动验证输入 `# ` 自动转换一级标题。
- [x] 4.2 手动验证列表、引用、代码块等基础 Markdown 输入规则和显示效果。
- [x] 4.3 手动验证已保存 Markdown 再次打开时按支持结构渲染。
- [x] 4.4 手动验证保存后数据库/API 中的 prompt 仍是 Markdown 文本，不含 HTML 或 Tiptap JSON。
- [x] 4.5 手动验证重置、保存失败、切换自动化详情时编辑器内容状态正确。
- [x] 4.6 运行 `pnpm install` 更新 workspace lockfile，如包依赖或 workspace 依赖发生变化。
- [x] 4.7 运行 `pnpm build` 或至少验证 `@willow/editor-md` 可被 `app/work` 类型解析与构建解析。
- [x] 4.8 运行 `cd app/work && pnpm lint`。
