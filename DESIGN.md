# Willow DESIGN.md

## Product UI Intent

Willow 的 renderer 默认是桌面工作台，不是营销页。界面气质应当冷静、专注、工具型，优先帮助用户高频完成任务，而不是制造情绪化视觉冲击。

这份规范适用于 `app/work` 下基于 Vue 3 + `shadcn-vue` 的业务界面，尤其是列表页、设置页、弹窗表单、空状态和侧边栏内容区。不适用于官网、活动页或需要独立品牌表达的宣传页面。

设计目标：

- 保持秩序感，信息层级一眼可扫
- 提高效率，减少无意义装饰和过大留白
- 让相同类型页面拥有一致的布局骨架和操作层级
- 让 AI 代理和工程师都能直接产出风格稳定的界面

## Visual Foundation

### Theme Baseline

项目当前 `shadcn-vue` 基线来自 [`app/work/components.json`](/Users/liujinglun/code/willow/app/work/components.json)：

- `style`: `new-york`
- `baseColor`: `neutral`
- `cssVariables`: `true`

项目可使用组件和组件用法使用 `shadcn-vue` 的 mcp 进行查询

项目视觉 token 的唯一来源是 [`app/work/src/renderer/index.css`](/Users/liujinglun/code/willow/app/work/src/renderer/index.css)。不要为页面私自发明第二套语义 token，也不要在 prompt 里要求不存在的主题变量。

### Color Roles

- `background`: 整个应用内容面的默认底色，优先保持干净、平稳，不做大面积渐变背景
- `card`: 卡片、区块、弹窗内容面的基础表面色，用来建立分区而不是制造悬浮感
- `primary`: 主操作、关键高亮、当前步骤或主要状态的强调色，只在需要明确推进动作时使用
- `muted`: 次级背景、弱提示、辅助容器和说明型区域的底色
- `border`: 结构边界、表单输入、卡片分割和轻量层次的主力手段
- `sidebar`: 左侧导航及其内部层级的专属表面色，不要和主内容区混用

### Surface, Border, Shadow

- 优先用浅表面 + 细边框建立层次，而不是重阴影
- 卡片、对话框、设置区块默认先依赖 `card` 与 `border`
- 阴影保持克制，只在弹窗、浮层、悬浮菜单等需要脱离背景时轻量使用
- 分割线要服务信息分组，不要为了“丰富界面”而过度堆叠

### Radius And Contrast

- 所有圆角遵循现有 `--radius` 体系，不在页面内手写明显偏离的圆角
- 对比关系优先通过表面、文字和边框完成，不依赖高饱和装饰色
- 默认以浅色基线进行设计；暗色只保持与现有变量兼容，不为暗色额外创造另一套视觉语言

## Typography And Density

### Text Hierarchy

- 页面标题：用于表达当前页面任务，简短直接，通常搭配 1 句说明
- 区块标题：用于划分设置区、列表区、详情区，强调结构而不是情绪
- 正文：用于任务说明、项目摘要、列表内容，保证快速扫描
- 说明文字：用于补充约束、风险和空状态引导，长度应明显短于正文
- 标签文字：用于 Badge、字段标签、辅助状态，不要承担长段叙述

### Density

- 默认信息密度偏紧凑，但不能拥挤
- 优先让用户在桌面宽度下快速完成浏览、比较和操作
- 页面不应出现大面积无信息留白，除非它正在服务空状态或加载状态
- 同一块内容中，间距应该稳定重复，避免每一层都用不同的 padding / gap

### Copy Style

- 标题和按钮文案直接表达动作，不写营销式 slogan
- 说明文案短而明确，优先说明“做什么”和“会发生什么”
- 避免超长段落、过多感叹式语气和 hero 文案结构

## Layout Patterns

### Page Header

标准页面头部应包含：

- 左侧：页面标题 + 一句简短说明
- 右侧：主操作，必要时加 1 个次操作

规则：

- 主按钮放在右上最稳定位置
- 不要在头部堆叠过多筛选器、统计卡和装饰元素
- 如果页面很复杂，把控制项下沉到内容区的工具条，而不是把头部做成控制面板

### Content Container

- 内容区优先使用稳定的水平内边距和垂直节奏
- 桌面端页面默认围绕单列主内容组织，需要时在内部再分区
- 大多数业务页优先用卡片、列表、分组表单组织，而不是自由拼贴

### List Pages

列表页默认骨架：

1. 页面头部
2. 概要说明或筛选工具条
3. 列表主体
4. 空状态 / 错误态 / 加载态替换列表主体

规则：

- 列表项优先展示标题、关键信息摘要、状态和操作
- 卡片列表适合信息块较复杂的场景
- 表格适合高对比字段型数据
- 不确定时，优先“卡片分组 + 清晰摘要”，而不是超宽表格

### Settings And Forms

设置页和表单页应优先分组：

- 每组只解决一个主题
- 每组有标题、短说明和字段主体
- 危险操作与普通设置分开摆放

规则：

- 单字段不要占满一个巨大区块
- 字段之间的垂直间距保持一致
- 用 `Separator` 或分组卡片建立逻辑边界，而不是靠大段空白

### Empty States

空状态应当包含：

- 直白说明当前为什么是空的
- 这一页可以做什么
- 一个明确的主操作

规则：

- 空状态优先使用 `Card` 或受控容器承载
- 不要用插画或营销话术喧宾夺主
- 主按钮文案直接指向下一步动作

### Dialog And Sheet

- `Dialog` 用于聚焦型确认、短表单、关键创建流
- `Sheet` 用于需要保留页面上下文的辅助配置或较长编辑流

规则：

- 不要把复杂多步骤流程塞进小弹窗
- 表单较长时优先 `Sheet` 或页面内编辑
- 弹层头部要清楚说明目的，底部操作区保持稳定顺序

## shadcn-vue Component Recipes

### `Button`

- `default` 只给页面主操作、提交、确认
- `outline` 或 `secondary` 给次操作、返回、查看详情
- 危险动作只在明确删除、停用、重置时使用 destructive 风格

不要：

- 一个区域出现多个视觉同级的主按钮
- 为了“醒目”把普通按钮都做成主按钮

### `Card`

- 作为列表项、设置分组、空状态容器和详情区的默认结构组件
- 适合承载标题、摘要、状态和局部操作

不要：

- 给每张卡片叠加很强阴影或花哨渐变
- 用卡片替代页面级布局逻辑

### `Dialog`

- 用于短流程创建、关键确认、轻量编辑
- 标题、说明、表单主体、底部操作区的结构要稳定

不要：

- 在小弹窗中塞入需要大范围扫描的信息
- 在弹窗里再套重型弹窗流程

### `Sheet`

- 用于上下文保留更重要的设置或编辑场景
- 适合较长表单、分组编辑和需要边看边改的内容

不要：

- 把简单二次确认放进 `Sheet`
- 用 `Sheet` 承载没有结构的长文案

### `Input` / `Textarea`

- `Input` 用于短文本、标识符、时间等结构化输入
- `Textarea` 用于提示词、备注、描述型输入
- 优先配合清晰字段标签和短说明

不要：

- 用 placeholder 承担主要说明
- 把很长的 prompt 放进单行输入框

### `Select`

- 用于有限集合选择，如模式、工作空间、状态
- 优先提供稳定、可预测的选项命名

不要：

- 用 `Select` 承载超长帮助说明
- 对二元开关场景滥用 `Select`

### `Badge`

- 用于状态、类型、级别、轻量标签
- 只显示最关键的短信息

不要：

- 在同一条列表项里堆太多 Badge
- 用 Badge 替代正文摘要

### `Separator`

- 用于逻辑分组、操作区和内容区之间的轻量边界
- 让视觉分区更明确，但不增加压迫感

不要：

- 每隔一小段内容就加一条分割线

### `Skeleton`

- 用于列表和卡片加载时的结构占位
- 骨架应接近真实布局，让用户预期稳定

不要：

- 骨架结构和最终内容完全无关
- 在很短的加载里闪烁复杂骨架

### `Sidebar`

- 作为全局导航与上下文切换的稳定框架
- 内容页与 sidebar 视觉分层要明确，但保持同一系统感

不要：

- 让 sidebar 和主内容区竞争视觉主导权
- 在 sidebar 中塞入过多彩色强调块

## Interaction And States

### Loading

- 优先使用 `Skeleton` 或局部 loading，而不是整页跳闪
- 保持原有布局骨架，让用户知道内容将出现在哪里

### Empty

- 用简短说明解释“为什么为空”与“下一步做什么”
- 只保留一个主操作，必要时加一条辅助说明

### Error

- 错误信息要可理解，避免只显示技术词
- 页面级错误放在内容区顶部或主容器内，不要到处漂浮

### Disabled

- 禁用态应明确可见，但仍可读
- 如果禁用有前置条件，说明原因，不让用户猜

### Success

- 成功反馈保持轻量，优先在提交后局部提示
- 不要把普通成功做成喧闹的庆祝状态

### Destructive

- 删除、停用、重置等动作必须与普通操作拉开层级
- 危险动作前优先使用确认对话框，文案明确结果不可逆时尤其要直接说明

### Hover / Focus / Selected

- Hover 只做轻量提示，不做剧烈位移或发光效果
- Focus 需要清楚但克制，不能破坏整体布局
- Selected 用边框、背景或状态色轻量强化，不要用过多装饰

### Motion

- 动效保持轻量和功能性
- 优先复用现有 collapse / dialog / sheet 过渡语义
- 避免花哨动画、弹跳、长时渐变和与任务无关的表演性 motion

## Do / Don't

### Do

- 沿用现有 token 和组件体系
- 让标题、摘要、状态、操作形成稳定层级
- 优先使用 `Card`、`Separator`、轻边框来建立结构
- 让主操作位置稳定、文案直接
- 让空状态和错误态都能明确指导下一步
- 为 AI 生成页面时先确定页面骨架，再填充组件

### Don't

- 不要私自新增品牌色或第二套主题命名
- 不要把业务页面做成 marketing landing
- 不要堆叠过多 Badge、阴影、渐变和装饰性图形
- 不要让一个页面出现多个同级主按钮
- 不要用超长文案替代清晰结构
- 不要要求不存在的组件、token 或字体资源

## AI Prompt Contract

### Global Instruction

在为 Willow 生成或修改 renderer UI 时，默认遵守以下约束：

```text
Use Willow's project DESIGN.md as the visual contract. Build a calm, focused, desktop workbench UI with Vue 3 + shadcn-vue. Preserve the existing new-york + neutral theme baseline and current CSS variable tokens. Prefer structured cards, restrained borders, compact-but-readable spacing, and clear action hierarchy. Avoid marketing-page hero sections, decorative gradients, oversized empty space, and multiple competing primary buttons.
```

### List Page Prompt Template

```text
Design a Willow renderer list page using shadcn-vue. Use a stable page header with title, one-line description, and a primary action on the right. The content area should prioritize scanability: grouped cards or a clean list/table hybrid, concise summaries, restrained badges, and clear status/action hierarchy. Follow Willow DESIGN.md: desktop workbench tone, compact spacing, existing theme tokens only, no landing-page styling.
```

### Settings Page Prompt Template

```text
Design a Willow settings page with shadcn-vue components. Group fields by topic using cards or clear separators. Each group should have a short title, a concise explanation, and structured controls. Keep the layout compact, readable, and tool-like. Use existing theme tokens, keep shadows minimal, separate destructive actions from normal settings, and avoid oversized decorative sections.
```

### Dialog Form Prompt Template

```text
Design a Willow dialog-based form with shadcn-vue. Use a clear dialog title, one-sentence description, structured fields, and a stable footer with one primary confirm action plus secondary cancel. Prefer Input, Textarea, Select, Badge, and Card patterns that match Willow DESIGN.md. Keep the flow short, focused, and non-marketing; use concise helper text and avoid visual noise.
```

## Working Rules

- 新增或改造 renderer 页面时，先读 OpenSpec 再读本文件
- OpenSpec 决定功能与行为，本文件决定默认视觉和组件表达
- 如果功能设计与本文件冲突，先以 OpenSpec 为准，再决定是否回补本文件
