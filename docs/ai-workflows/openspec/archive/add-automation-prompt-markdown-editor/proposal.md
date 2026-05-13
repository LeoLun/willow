# add-automation-prompt-markdown-editor

## Summary

在 `packages/` 下新增独立 Markdown 编辑器包 `@willow/editor-md`，基于 `@tiptap/vue-3` 提供可复用的 Markdown 编辑组件，并将自动化详情页中的提示词 `Textarea` 替换为该包提供的编辑器。用户在编辑自动化 prompt 时可以直接输入 Markdown，并获得接近 Markdown 渲染后的所见即所得体验。例如输入 `# ` 后自动转换为一级标题，输入列表、引用、代码块等 Markdown 结构时也能转换为对应块级内容。

## Problem

当前 [AutomationDetail.vue](/Users/liujinglun/code/willow/app/work/src/renderer/src/pages/auto/detail/AutomationDetail.vue) 使用普通 `Textarea` 编辑自动化 prompt。它能保存纯文本，但长提示词的结构感不足，用户无法在页面内直观看到标题、列表、引用和代码块等 Markdown 结构，也无法使用 Markdown 快捷输入快速组织内容。

自动化 prompt 本质上仍然是发送给 AI 的文本指令，因此这次不应把数据模型改成富文本 JSON。编辑体验可以升级为 Tiptap，但保存语义必须继续保持为可读、可迁移、可直接执行的 Markdown 文本。

由于 Markdown 编辑器不是自动化详情页独有能力，应该抽成 workspace 包，避免把编辑器生命周期、Markdown 解析和序列化逻辑散落在 `app/work` 页面代码中。

## Goals

- 新增 workspace 包 `packages/editor-md`，包名为 `@willow/editor-md`。
- `@willow/editor-md` 导出基于 `@tiptap/vue-3` 的 Markdown 编辑器组件。
- 自动化详情页的提示词编辑区使用 `@willow/editor-md` 组件替代现有 `Textarea`。
- 编辑器支持 Markdown 输入快捷转换，例如 `# ` 转一级标题、`## ` 转二级标题、`- ` 转无序列表、`1. ` 转有序列表、`> ` 转引用、`` ``` `` 转代码块。
- 编辑器展示已保存 Markdown 时，应按支持的 Markdown 结构渲染为可读富文本，而不是只显示原始标记。
- 用户保存自动化时，系统仍向现有更新接口提交 Markdown 文本字符串。
- 编辑器必须继续参与详情页现有脏状态、重置、校验、保存成功和保存失败流程。
- 页面视觉与交互必须遵守仓库根 `DESIGN.md`，保持桌面工作台式密度，不引入营销化或文档站式编辑界面。
- 优先复用仓库已有 Tiptap 依赖和包结构，不为本需求引入新的重型编辑器框架。

## Non-Goals

- 不把自动化 prompt 持久化格式改为 Tiptap JSON、HTML 或 ProseMirror document。
- 不新增独立 Markdown 预览模式、双栏预览、完整命令菜单或工具栏。
- 不支持图片上传、表格、数学公式、任务列表等本次未要求的扩展 Markdown 能力。
- 不改变自动化执行链路、调度逻辑、模型选择或工作空间配置。
- 不要求自动化创建弹窗在本次接入 `@willow/editor-md`，除非实现阶段确认可以无风险复用。

## Success Criteria

- workspace 中存在 `packages/editor-md`，其 package name 为 `@willow/editor-md`，并可被 `app/work` 通过 `workspace:*` 引用。
- 用户打开自动化详情页后，提示词区域不再是 `Textarea`，而是来自 `@willow/editor-md` 的 Tiptap Markdown 编辑器。
- 用户输入 `# ` 后，当前段落转换为一级标题，并可继续输入标题内容。
- 用户输入常见 Markdown 块级语法后，编辑器按对应结构展示内容。
- 已保存的 Markdown prompt 再次打开时，支持的结构被渲染为标题、列表、引用或代码块等富文本结构。
- 保存时写回的 `automation.prompt` 仍是 Markdown 文本，后续自动化运行拿到的内容不包含 HTML 标签或 Tiptap JSON。
- 重置按钮可将编辑器内容恢复为服务端当前值；保存失败不会清空编辑器内未提交内容。
- `pnpm --filter willow-work lint` 或 `cd app/work && pnpm lint` 通过，必要时补充手动验证记录。

## Viable Approaches

### Approach A: 直接在 AutomationDetail.vue 内内联 Tiptap 编辑器

在详情页中直接使用 `useEditor`、`EditorContent` 和 `StarterKit`，通过 watcher 与 `prompt` ref 同步。

优点：
- 改动最小，能快速替换当前 `Textarea`。
- 不需要提前设计公共组件 API。

缺点：
- 详情页会混入较多编辑器生命周期、Markdown 解析和序列化细节。
- 后续创建弹窗或其他 prompt 编辑场景复用成本较高。
- 不满足“抽成单独包”的目标。

### Approach B: 在 `app/work` 内新增自动化 Prompt Markdown 编辑器组件

创建专用的 renderer 组件，例如 `AutomationPromptEditor.vue`，内部封装 Tiptap 初始化、Markdown 输入规则、Markdown 到编辑器内容的加载、编辑器内容到 Markdown 的输出、placeholder 和样式。`AutomationDetail.vue` 只通过 `v-model` 使用它。

优点：
- 详情页保持聚焦在自动化表单状态和保存逻辑。
- 编辑器同步、销毁和样式约束集中管理，后续复用更容易。
- 更符合已有 sender Tiptap 组件的封装方向。

缺点：
- 文件数量略增。
- 需要为组件 API 设定清晰边界，避免过早做成通用 Markdown 编辑器。
- 组件仍被锁在 `app/work` 内，无法作为 workspace 基础能力复用。

### Approach C: 使用现有 `@willow/sender` Tiptap 编辑器改造详情页

尝试复用 `packages/sender/src/components/Editor.vue`。

优点：
- 最大化复用已有 Tiptap 基础。

缺点：
- Sender 编辑器面向聊天输入，禁用了 heading/list/code 等结构，并包含文件与技能标签逻辑。
- 复用会把聊天输入语义泄漏到自动化 prompt 编辑，反而增加耦合。

### Approach D: 新增 `@willow/editor-md` 包并由自动化详情页消费

在 `packages/editor-md` 中新增独立包，导出 Markdown 编辑器组件、必要类型和样式入口。`app/work` 通过 `@willow/editor-md` 使用编辑器，详情页只负责表单状态与保存逻辑。

优点：
- 满足独立包诉求，编辑器能力可被后续自动化创建、设置页或其他 prompt 场景复用。
- 页面代码保持轻，Markdown 解析、序列化和 Tiptap 生命周期集中在包内。
- 可以沿用 `@willow/sender` 的 workspace 包形态，但避免复用聊天输入语义。

缺点：
- 需要新增 package、导出入口、类型声明和 app 依赖。
- 包 API 需要保持克制，避免一次性做成过大的通用编辑器平台。

## Recommendation

采用 Approach D。自动化详情页需要的是“长 prompt Markdown 编辑器”，而不是聊天 sender；同时用户明确要求将 Editor 抽成独立包。因此本变更应新增 `@willow/editor-md`，把 Markdown 文本持久化边界固定在包 API 上：Tiptap 只改善编辑体验，自动化系统继续保存和执行 Markdown 文本。
