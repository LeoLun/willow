# Design: merge-sender-slash-resource-picker

## Overview

本变更将 sender 中“技能选择”和“工作空间文件选择”合并为一个 `/` 资源选择器。`/` 不再只代表技能，而是代表当前消息可插入或启用的上下文资源，包括插件、技能和文件。`@` 不再作为文件搜索触发符。

本设计以 [`ui/work.pen`](/Users/liujinglun/code/willow/ui/work.pen) 的 `Willow / Sender Component States` / `03 输入 / 后效果` 为视觉基准，并遵守根目录 [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md) 的工作台设计约束。

## Current State

`@willow/sender` 当前已有：

- `useTriggerManager()` 支持多个触发字符，目前注册 `/` 与 `@`。
- `Sender.vue` 分别渲染 `SkillPickerPanel` 与 `FilePickerPanel`。
- `/` 触发技能面板，选择后插入 `SkillTag`。
- `@` 触发文件面板，选择后插入 `FileTag`。
- 左下 `+` 已作为系统文件选择器入口，通过 `select-files` 事件交给宿主处理。
- `SenderSendPayload` 已包含 `selectedSkills` 与 `selectedFiles`。

历史 OpenSpec 已定义：

- `add-chat-skill-picker`：技能选择、技能标签、`selectedSkills`。
- `add-sender-file-mention`：`@` 文件选择、文件标签、`selectedFiles`。
- `add-sender-system-file-picker`：`+` 系统文件选择入口。

本变更在这些基础上更新入口与弹层模型，不重新定义标签和发送 payload 的底层语义。

## UI Reference Mapping

`work.pen` 的 `03 输入 / 后效果` 映射如下：

- 外层输入器：单个圆角 sender 容器，保留边框、浅表面和紧凑 padding。
- 编辑区：用户已输入 `/`，该字符显示在输入器正文区域。
- 底部工具栏：左侧依次为 `+`、`/`、联网开关、模型选择，右侧为发送按钮。
- 弹层：位于输入器上方，宽度与输入器对齐，单个圆角浮层，轻阴影。
- 分组：弹层内部按 `插件`、`技能`、`文件` 展示。
- 行样式：左侧图标，中部名称与描述或路径；活动项使用浅灰底，不使用强色块。

实现时应优先使用 `@willow/shadcn` 基础组件、现有 token 和 lucide 图标；不要新增平行主题，也不要把弹层拆成多个卡片或多个独立 popover。

## Unified Resource Model

sender 内部应引入统一候选项模型，逻辑上至少包含三类：

- `plugin`：插件候选项，展示插件名称和简短描述。
- `skill`：技能候选项，复用现有 `SenderSkillOption`。
- `file`：文件候选项，复用现有 `SenderFileOption`。

候选项应能提供统一渲染字段：

- `type`
- `id` 或稳定 key
- `label`
- `description`
- `icon`
- `disabled` 或 `selected` 状态

技能和文件的真实发送结构不应被统一模型抹平。选择后仍需分别落到：

- 技能：`SkillTag` 与 `selectedSkills`
- 文件：`FileTag` 与 `selectedFiles`
- 插件：宿主定义的插件选择结果；若当前实现阶段没有完整插件发送链路，可先作为 host-provided 可选候选能力，但不能阻塞技能与文件合并。

## Trigger Behavior

### Slash Trigger

`/` 是唯一的资源搜索触发符。

- 输入 `/` 打开统一资源选择器。
- 输入 `/query` 后，用 `query` 同时过滤插件、技能和文件。
- 过滤字段：
  - 插件：名称、描述。
  - 技能：名称、描述。
  - 文件：文件名、工作空间相对路径。
- 选择候选项后，删除当前 `/query` 触发文本，并插入或启用对应资源。

### At Sign

`@` 不再注册为 sender 文件搜索触发符。

- 用户输入 `@` 时，内容保留为普通文本。
- 输入邮箱、账号、路径片段或自然语言中的 `@` 不应打开任何资源面板。
- 若未来需要 `@` 的新语义，必须另起 OpenSpec。

### Manual Toolbar Entry

底部工具栏中的 `/` 图标按钮应打开同一个统一资源选择器，查询为空。

现有工作空间文件手动入口不应再打开独立 `@` 文件面板。实现可选择：

- 移除独立工作空间文件按钮，只保留 `/` 统一资源按钮。
- 或将文件按钮重定向到统一资源选择器，并使其初始聚焦文件分组。

推荐移除独立工作空间文件按钮，以更贴近 `work.pen` 中的工具栏结构。

`+` 按钮继续表示系统文件选择器，不参与 `/` 弹层过滤。

## Panel Structure

统一弹层建议新增 `ResourcePickerPanel.vue` 或等价组件，替代分离的 `SkillPickerPanel` 与 `FilePickerPanel` 渲染路径。旧组件可以删除，也可以被新组件内部复用，但用户侧只能看到一个弹层。

弹层渲染规则：

- 分组顺序为 `插件`、`技能`、`文件`。
- 每个分组有短标题，字体与 `work.pen` 中灰色分组标题接近。
- 没有候选项的分组默认隐藏。
- 查询无结果时，显示一个统一空状态，例如 `没有匹配的资源。`
- 加载与错误状态应按来源轻量展示，不阻断其他来源结果。
- 结果行必须截断长描述和长路径，不能撑开弹层。

活动项规则：

- 上下键在所有可见结果组成的扁平列表中移动。
- 活动项使用浅底色，与 `work.pen` 的技能活动行一致。
- Enter 选择当前活动项。
- Escape 关闭弹层并保留用户已经输入的正文，除非已经完成选择。

## Selection Semantics

### Skill Selection

选择技能后：

- 删除 `/query`。
- 插入现有 `SkillTag`。
- 已选技能去重规则保持现有 `scope:filePath` key。
- 发送时 `selectedSkills` 继续由编辑器中的技能标签生成。

### File Selection

选择文件后：

- 删除 `/query`。
- 插入现有 `FileTag`。
- 已选文件去重规则保持现有 `path` key。
- 发送时 `selectedFiles` 继续由编辑器中的文件标签生成。
- `message` 文本中的文件引用格式保持现状，不通过解析正文反推文件。

### Plugin Selection

统一弹层需要为插件分组预留 host-provided 数据结构和选择事件。实现阶段应优先复用应用已有插件发现或配置来源；若当前宿主尚无稳定插件发送链路，插件候选可以先作为受控可选输入，不应硬编码示例数据。

插件选择的最终行为必须由宿主掌握，避免 `@willow/sender` 直接依赖插件运行时、MCP 或 app/work 内部模块。

## Public API Impact

`@willow/sender` 建议新增或调整：

- `plugins?: SenderPluginOption[]`
- `pluginsLoading?: boolean`
- `pluginsErrorMessage?: string`
- `selectedPlugins?: SenderPluginReference[]` 或等价事件，取决于实现阶段已有插件模型

同时保留：

- `skills`
- `files`
- `selectedSkills`
- `selectedFiles`
- `select-files` 系统文件选择事件

若实现阶段发现插件选择没有稳定产品语义，允许将插件 API 作为任务中的后置项，但弹层组件结构必须支持插件分组，避免后续再次拆面板。

## Visual Constraints

- 弹层宽度与输入器对齐，放置在输入器上方。
- 弹层使用单个 `bg-card` / `border-border` 表面和轻量 shadow。
- 分组之间使用稳定 `gap`，不加多层嵌套卡片。
- 行高接近 `work.pen`：插件和技能行约 38px，文件行约 34px；实现可按现有字体与 token 微调。
- 图标使用 lucide，插件可用宿主提供图标或统一插件图标。
- 活动行使用 `bg-muted` / `bg-accent` 一类浅色状态，不使用强品牌色。
- 输入器底部工具栏保持一行稳定排列；文本不能挤压发送按钮。

## Risks And Mitigations

### 风险：旧用户仍习惯输入 `@` 选择文件

缓解：本次规格明确取消 `@` 文件触发，避免双入口长期并存。若需要迁移提示，应使用极短、非阻断的 UI 提示，并单独在实现计划中确认。

### 风险：统一搜索结果过多

缓解：弹层限制最大高度并滚动；活动项按可见扁平列表导航。若性能不足，再另起变更讨论分页或异步搜索。

### 风险：插件选择语义尚未完全落地

缓解：统一候选模型为插件预留分组和 host API，但不让插件阻塞技能与文件合并。不能硬编码 UI 稿中的 `Browser Use` 作为真实数据。

## Verification Focus

- 输入 `/` 打开单个统一弹层。
- 输入 `/query` 同时过滤技能和文件；有插件数据时也过滤插件。
- 输入 `@` 不打开文件面板。
- ArrowUp / ArrowDown / Enter / Escape 对统一弹层生效。
- 选择技能后插入技能标签并输出 `selectedSkills`。
- 选择文件后插入文件标签并输出 `selectedFiles`。
- 点击工具栏 `/` 打开同一个统一弹层。
- 点击 `+` 仍打开系统文件选择器。
- 弹层视觉与 `work.pen` 的 `03 输入 / 后效果` 对齐。
- `pnpm lint` 通过；涉及共享包构建时运行 `pnpm build`。
