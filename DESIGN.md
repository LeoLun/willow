---
version: alpha
name: Willow
description: Design Tokens for the Willow Desktop Workbench Application.
colors:
  background: "#ffffff"
  foreground: "#252525"
  card: "#ffffff"
  card-foreground: "#252525"
  popover: "#ffffff"
  popover-foreground: "#252525"
  primary: "#343434"
  primary-foreground: "#fafafa"
  secondary: "#f7f7f7"
  secondary-foreground: "#343434"
  muted: "#f7f7f7"
  muted-foreground: "#8e8e8e"
  accent: "#f7f7f7"
  accent-foreground: "#343434"
  destructive: "#b91c1c"
  border: "#ebeebe"
  input: "#ebeebe"
  ring: "#b5b5b5"
  sidebar: "#fafafa"
  sidebar-foreground: "#252525"
  sidebar-primary: "#343434"
  sidebar-primary-foreground: "#fafafa"
  sidebar-accent: "#f7f7f7"
  sidebar-accent-foreground: "#343434"
  sidebar-border: "#ebeebe"
  sidebar-ring: "#b5b5b5"
typography:
  body:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  heading:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
---

# Willow DESIGN.md

## Overview

Willow 的 renderer 默认是桌面工作台，不是营销页。界面气质应当冷静、专注、工具型，优先帮助用户高频完成任务，而不是制造情绪化视觉冲击。

本规范适用于 `app/work` 下基于 Vue 3 + `shadcn-vue` 的业务界面，尤其是列表页、设置页、弹窗表单、空状态和侧边栏内容区。不适用于官网、活动页或需要独立品牌表达的宣传页面。

### 设计目标 (Design Goals)

- **保持秩序感**：信息层级一眼可扫，具备强扫描性。
- **提高效率**：减少无意义装饰和过大留白。
- **一致性**：让相同类型页面拥有一致的布局骨架和操作层级。
- **双向赋能**：让 AI 代理和工程师都能直接产出风格稳定的界面。

### 主题基准 (Theme Baseline)

项目当前 `shadcn-vue` 基线来自 [`components.json`](/Users/liujinglun/code/willow/components.json)：

- `style`: `new-york`
- `baseColor`: `neutral`
- `cssVariables`: `true`
- `iconLibrary`: `lucide`

项目视觉 token 的唯一来源是 [`app/work/src/renderer/index.css`](/Users/liujinglun/code/willow/app/work/src/renderer/index.css)。不要为页面私自发明第二套语义 token，也不要在 prompt 里要求不存在的主题变量。

### 工作规则 (Working Rules)

- 新增或改造 renderer 页面时，先读 OpenSpec 再读本文件。
- OpenSpec 决定功能与行为，本文件决定默认视觉和组件表达。
- 如果功能设计与本文件冲突，先以 OpenSpec 为准，再决定是否回补本文件。

---

## Colors

Willow 的颜色系统以高对比度的中性色（Neutrals）为主，仅在必要时使用低饱和度的功能性状态颜色。这能最大程度降低视觉干扰。

### 语义色彩角色 (Semantic Color Roles)

- **`background`**: 整个应用内容面的默认底色，优先保持干净、平稳，不做大面积渐变背景。
- **`foreground`**: 默认文本前景色，保证最高文本可读性。
- **`card`**: 卡片、区块、弹窗内容面的基础表面色，用来建立分区而不是制造悬浮感。
- **`primary`**: 主操作、关键高亮、当前步骤或主要状态的强调色，只在需要明确推进动作时使用。
- **`muted`**: 次级背景、弱提示、辅助容器和说明型区域的底色。
- **`border`**: 结构边界、表单输入、卡片分割和轻量层次的主力手段。
- **`sidebar`**: 左侧导航及其内部层级的专属表面色，不要和主内容区混用。
- **`destructive`**: 专门用于危险/删除等毁灭性动作的警示色。

---

## Typography

我们通过统一的字体和高对比度的字重来区分信息层级，保持整体排版偏向紧凑，以适应高密度的桌面业务场景。

### 字体族 (Font Family)

- **无衬线字体 (UI & Text)**: 全局使用 `"Inter Variable"`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif`。
- **等宽字体 (Code blocks & Technical details)**: 代码块和技术信息使用 `SFMono-Regular`, `Consolas`, `Liberation Mono`, `monospace`。

### 文本层级 (Text Hierarchy)

- **页面标题 (Page Title)**: 用于表达当前页面任务，简短直接，通常搭配 1 句说明。字重 600，行高 1.2。
- **区块标题 (Section Heading)**: 用于划分设置区、列表区、详情区，强调结构而不是情绪。字重 600，行高 1.25。
- **正文 (Body)**: 用于任务说明、项目摘要、列表内容，保证快速扫描。字重 400，行高 1.5。
- **说明文字 (Description)**: 用于补充限制条件、风险和空状态引导，长度应明显短于正文。字重 400，行高 1.4。
- **标签文字 (Label)**: 用于 Badge、字段标签、辅助状态，字重 500/600，不要承担长段叙述。

### 排版密度与文案风格 (Density & Copy Style)

- 标题和按钮文案直接表达动作，不写营销式 slogan。
- 说明文案短而明确，优先说明“做什么”和“会发生什么”。
- 避免超长段落、过多感叹式语气和 hero 文案结构。

---

## Layout

Willow 采用经典的桌面应用程序三栏或双栏骨架，所有内容区块边界清晰，不允许出现无界限的宽屏流式布局。

### 间距节奏 (Spacing Rhythm)

- 默认信息密度偏紧凑，但不能拥挤。优先让用户在桌面宽度下快速完成浏览、比较和操作。
- 页面不应出现大面积无信息留白，除非它正在服务空状态或加载状态。
- 同一块内容中，间距应该稳定重复，避免每一层都用不同的 padding / gap。
- 常规页面内容优先使用 `p-6`、`p-8`、`gap-3`、`gap-4`、`space-y-4` 一类稳定节奏；小型列表行可使用 `px-2 py-1` 到 `p-4` 的紧凑密度。
- 图标按钮优先使用 `size="icon"` 并约束到 `size-6` 或 `size-8`，保持工具型界面的扫描效率。

### 页面头部 (Page Header)

标准页面头部应包含：

- **左侧**: 页面标题 + 一句简短说明。
- **右侧**: 主操作，必要时加 1 个次操作。
- _规则_: 主按钮放在右上最稳定位置。不要在头部堆叠过多筛选器、统计卡和装饰元素。如果页面很复杂，把控制项下沉到内容区的工具条，而不是把头部做成控制面板。

### 内容容器 (Content Container)

- 内容区优先使用稳定的水平内边距和垂直节奏。
- 桌面端页面默认围绕单列主内容组织，需要时在内部再分区。
- 大多数业务页优先用卡片、列表、分组表单组织，而不是自由拼贴。
- 主应用框架保持 `SidebarProvider` + 左侧导航 + 内容面的结构，内容面可用 `Card` 或稳定容器承载，但不要在页面内部重复制造多层外壳。
- 宽度受控页面可使用 `max-w-2xl`、`w-[80%]` 等项目已有模式，但同一页面内宽度规则要一致。

### 列表页面 (List Pages)

列表页默认骨架：

1. 页面头部
2. 概要说明或筛选工具条
3. 列表主体
4. 空状态 / 错误态 / 加载态替换列表主体

- _规则_: 列表项优先展示标题、关键信息摘要、状态 and 操作。卡片列表适合信息块较复杂的场景；表格适合高对比字段型数据。不确定时，优先“卡片分组 + 清晰摘要”，而不是超宽表格。

### 设置与表单 (Settings & Forms)

设置页和表单页应优先分组：

- 每组只解决一个主题，拥有标题、短说明和字段主体。
- 危险操作与普通设置分开摆放。
- _规则_: 单字段不要占满一个巨大区块。字段之间的垂直间距保持一致。用 `Separator` 或分组卡片建立逻辑边界，而不是靠大段空白。
- 表单字段使用 `Label` + `Input` / `Textarea` / `Switch` / `ToggleGroup` / `DropdownMenu` 等 shadcn 组件组合。
- 二元状态使用 `Switch`；少量互斥模式使用 `ToggleGroup`；需要展示当前值并打开候选列表时使用 `DropdownMenu` 或 `Select`。
- 字段校验、保存中和不可用状态必须反映到 shadcn组件的 `disabled`、错误文案或局部反馈上。

### 空状态 (Empty States)

空状态应当包含：

- 直白说明当前为什么是空的。
- 这一页可以做什么。
- 一个明确的主操作。
- _规则_: 空状态优先使用 `Card` 或受控容器承载。不要用插画或营销话术喧宾夺主。主按钮文案直接指向下一步动作。

### 对话框与抽屉 (Dialog & Sheet)

- **Dialog**: 用于聚焦型确认、短表单、关键创建流。
- **Sheet**: 用于需要保留页面上下文的辅助配置或较长编辑流。
- _规则_: 不要把复杂多步骤流程塞进小弹窗。表单较长时优先 `Sheet` 或页面内编辑。弹层头部要清楚说明目的，底部操作区保持稳定顺序。

---

## Elevation & Depth

在扁平化的工具风格中，我们通过轻量的边框和微弱的投影来建立层级关系，绝不滥用重度阴影。

### 表面、边框与阴影 (Surface, Border, Shadow)

- 优先用浅表面 + 细边框建立层次，而不是重阴影。
- 卡片、对话框、设置区块默认先依赖 `card` 与 `border`。
- 阴影保持克制，只在弹窗、浮层、悬浮菜单等需要脱离背景时轻量使用。
- 分割线要服务信息分组，不要为了“丰富界面”而过度堆叠。
- hover 面优先使用 `hover:bg-muted/40`、`hover:bg-muted/50` 或 shadcn 默认状态，不使用发光、位移或彩色描边制造反馈。

---

## Shapes

圆角是建立亲和力与界面秩序的关键。所有圆角遵循现有 `--radius` 体系，不在页面内手写明显偏离的圆角。

### 圆角规范 (Border Radius Scale)

- **`sm` (6px)**: 适用于小型按钮 (Button)、微标 (Badge)、以及下拉菜单项 (Dropdown Menu Item)。
- **`md` (8px)**: 适用于输入框 (Input)、下拉选择器 (Select)、文本域 (Textarea) 容器。
- **`lg` (10px - 默认 `--radius`)**: 适用于标准卡片 (Card)、弹窗 (Dialog) 和抽屉面板 (Sheet)。
- **`xl` (14px)**: 仅在少数大块卡片或特殊包裹层中使用。
- **完全圆角 (full)**: 适用于头像 (Avatar) 和胶囊形状态微标。

---

## Components

本项目使用 `@willow/shadcn` 作为底层组件库，结合 `@willow/ui` 作为业务级组件库。所有组件必须符合以下用法约定。

### 组件真相源 (Component Source of Truth)

- 基础组件从 `@willow/shadcn` 或 `@willow/shadcn/components/ui/*` 引入。
- 高阶业务 UI 优先从 `@willow/ui` 复用。
- 图标统一使用 `lucide-vue-next`。
- 只有在 `@willow/shadcn` 与 `@willow/ui` 都无法表达需求时，才创建新的业务组件。
- 不要直接从底层 headless UI 依赖拼装已有 shadcn 组件已经覆盖的控件。不要手写按钮、输入框、弹窗、菜单、Tooltip、Badge、Skeleton、Sidebar 等基础 UI 原语。

### shadcn-vue 组件配方 (Component Recipes)

#### 1. Button

- `default` 只给页面主操作、提交、确认。
- `outline` 或 `secondary` 给次操作、返回、查看详情。
- 危险动作只在明确删除、停用、重置时使用 destructive 风格。
- 高频行内操作优先用 `variant="ghost"` + `size="icon"` + lucide 图标。
- 文本按钮用于明确命令；纯图标按钮用于编辑、删除、展开、更多等标准工具动作，并配 `Tooltip` 或放入 `DropdownMenu`。
- _Don't_: 一个区域出现多个视觉同级的主按钮。为了“醒目”把普通按钮都做成主按钮。在同一行同时使用多个大尺寸文字按钮承载低优先级操作。

#### 2. Card

- 作为列表项、设置分组、空状态容器和详情区的默认结构组件。
- 适合承载标题、摘要、状态和局部操作。
- 使用 `CardHeader`、`CardTitle`、`CardDescription`、`CardContent`、`CardFooter` 时保持结构语义稳定。
- 简单列表项可以直接使用 `Card` + `CardContent` 或轻量 border 容器，不必强行套完整卡片头尾。
- _Don't_: 给每张卡片叠加很强阴影或花哨渐变。用卡片替代页面级布局逻辑。在卡片里再套一层纯装饰卡片。

#### 3. Dialog

- 用于短流程创建、关键确认、轻量编辑。
- 标题、说明、表单主体、底部操作区的结构要稳定。
- 统一使用 `DialogHeader`、`DialogTitle`、`DialogDescription`、`DialogFooter`。
- 取消按钮使用 `outline`，确认按钮使用 `default`；危险确认使用 `destructive`。
- 表单提交中要禁用确认按钮，并用按钮文案或局部状态说明当前进度。
- _Don't_: 在小弹窗中塞入需要大范围扫描的信息。在弹窗里再套重型弹窗流程。

#### 4. Sheet

- 用于上下文保留更重要的设置或编辑场景。
- 适合较长表单、分组编辑和需要边看边改的内容。
- 当编辑内容需要滚动、分组或和原页面同时参照时，优先考虑 `Sheet` 而不是把 `Dialog` 拉得很高。
- _Don't_: 把简单二次确认放进 `Sheet`。用 `Sheet` 承载没有结构的长文案。

#### 5. DropdownMenu

- 用于行内更多操作、轻量选择器、模型/工作区/时间等候选项。
- 触发按钮优先使用 `Button variant="ghost" size="icon"` 或紧凑 outline 按钮。
- 菜单内容保持短而可扫，危险项使用 destructive 语义并放在列表末尾。
- 需要当前选中态时，用勾选图标、`DropdownMenuCheckboxItem` 或明确的辅助文字表达。
- _Don't_: 把复杂表单塞进 `DropdownMenu`。用菜单隐藏页面唯一主操作。

#### 6. Tooltip

- 用于解释纯图标按钮、紧凑工具栏动作和不宜展开的状态说明。
- 文案保持 2 到 6 个汉字或一个短动词短语，例如“编辑”“删除”“设为默认”。
- _Don't_: 用 Tooltip 承载必须阅读的说明或错误信息。给已有清晰文字的普通按钮重复添加 Tooltip。

#### 7. ToggleGroup / Switch

- `ToggleGroup` 用于少量互斥选项，例如主题模式、周期类型、显示模式。
- `Switch` 用于开启/关闭型设置，左侧应有清楚标签与短说明。
- 图标 + 短文字的组合适合桌面设置项，但每项宽度和高度要保持稳定。
- _Don't_: 用多个普通按钮模拟互斥状态。用 `Switch` 表达多值选择。

#### 8. Input / Textarea

- `Input` 用于短文本、标识符、时间等结构化输入。
- `Textarea` 用于提示词、备注、描述型输入。
- 优先配合清晰字段标签 and 短说明。
- 密钥、路径、模型 ID 等机器可读值可使用等宽字体辅助扫描，但不要牺牲可读大小。
- 长 prompt 或自动化指令使用 `Textarea`，并给出合理高度和滚动策略。
- _Don't_: 用 placeholder 承担主要说明。把很长的 prompt 放进单行输入框。

#### 9. Select

- 用于有限集合选择，如模式、工作空间、状态。
- 优先提供稳定、可预测的选项命名。
- 如果本地尚未安装 `Select`，先通过 shadcn-vue MCP/CLI 添加到 `@willow/shadcn`，不要手写一个外观相似的下拉选择器。
- _Don't_: 用 `Select` 承载超长帮助说明。对二元开关场景滥用 `Select`。

#### 10. Badge

- 用于状态、类型、级别、轻量标签。只显示最关键的短信息。
- `default` 只用于最重要或当前默认状态；普通类型和供应商信息优先用 `outline` 或 `secondary`。
- Badge 文案要短，通常不超过 6 个汉字或一个短 token。
- _Don't_: 在同一条列表项里堆太多 Badge。用 Badge 替代正文摘要。

#### 11. Separator

- 用于逻辑分组、操作区和内容区之间的轻量边界。
- 让视觉分区更明确，但不增加压迫感。
- 分割线宽度和位置要跟内容容器对齐，不要为了造型随意使用奇怪比例。
- _Don't_: 每隔一小段内容就加一条分割线。

#### 12. Skeleton

- 用于列表和卡片加载时的结构占位。
- 骨架应接近真实布局，让用户预期稳定。
- 骨架的宽度、高度、圆角要贴近真实文本行、按钮、卡片或表单控件。
- _Don't_: 骨架结构和最终内容完全无关。在很短的加载里闪烁复杂骨架。

#### 13. Sidebar

- 作为全局导航与上下文切换的稳定框架。
- 内容页与 sidebar 视觉分层要明确，但保持同一系统感。
- 使用 `SidebarProvider`、`SidebarTrigger`、`SidebarMenuButton` 等 shadcn sidebar 组件维护折叠、焦点和导航语义。
- 左侧导航使用 `sidebar` 系列 token；主内容区使用 `background` / `card` / `muted` 系列 token。
- _Don't_: 让 sidebar 和主内容区竞争视觉主导权。在 sidebar 中塞入过多彩色强调块。

#### 14. ScrollArea / Resizable / Collapsible

- 长列表、时间选择、文件树和工具输出优先使用 `ScrollArea` 管理滚动区域。
- 需要用户调整宽度或高度的工作台面板使用 `Resizable`。
- 可展开的任务进度、文件树、说明区使用 `Collapsible` 或 `Accordion`。
- _Don't_: 在一个页面里制造多个互相嵌套且不可预期的滚动容器。用手写高度动画替代已有 `Collapsible` 语义。

### 业务级组件 (`@willow/ui`) 规范

- **MessageList / AssistantMessage / UserMessage**: 对话流的核心表现组件。
  - 用户气泡：靠右显示，背景轻量微透（`backdrop-filter: blur(10px)`），圆角结构清晰。
  - 助手气泡：靠左显示，背景透明，文本直接渲染在底色上，通过头像和缩进区分。
- **ThinkingBlock**: 折叠展示 AI 思考过程。默认呈紧凑的单行展开状态，内部包含带动画的加载指示器。
- **ToolCallCard & ToolCallDetailRow**: 工具调用状态卡片。在执行中时展现 loading 状态，执行完后呈折叠卡片形式。
- **AskUserPanel & PermissionApprovalPanel**: 权限和交互阻塞卡片。使用鲜明但克制的淡色背景进行视觉警示，提示用户点击确认或输入。

### 图标规范 (Icon Guidelines)

- **图标库**: 唯一指定 `lucide-vue-next`，不得引入其他图标库。
- **尺寸规范**:
  - 行内/按钮图标: 统一为 `14px` (`w-3.5 h-3.5`) 或 `16px` (`w-4 h-4`)。
  - 侧边栏大分类图标: 统一为 `18px` (`w-4.5 h-4.5`)。
- **辅助说明**: 纯图标按钮必须通过 `<Tooltip>` 包裹提供文字提示。

### AI 提示语契约 (AI Prompt Contract)

#### 全局指令 (Global Instruction)

在为 Willow 生成或修改 renderer UI 时，默认遵守以下约束：

```text
Use Willow's project DESIGN.md as the visual contract. Build a calm, focused, desktop workbench UI with Vue 3 + shadcn-vue. Use @willow/shadcn components as the required UI primitives and lucide-vue-next icons for icon actions. Preserve the existing new-york + neutral theme baseline and current CSS variable tokens. Prefer structured cards, restrained borders, compact-but-readable spacing, and clear action hierarchy. Avoid marketing-page hero sections, decorative gradients, oversized empty space, hand-written base controls, and multiple competing primary buttons.
```

#### 列表页模板 (List Page Prompt Template)

```text
Design a Willow renderer list page using shadcn-vue components from @willow/shadcn. Use a stable page header with title, one-line description, and a primary action on the right. The content area should prioritize scanability: grouped cards or a clean list/table hybrid, concise summaries, restrained badges, lucide icon actions with Tooltip when needed, and clear status/action hierarchy. Follow Willow DESIGN.md: desktop workbench tone, compact spacing, existing theme tokens only, no landing-page styling.
```

#### 设置页模板 (Settings Page Prompt Template)

```text
Design a Willow settings page with shadcn-vue components from @willow/shadcn. Group fields by topic using cards or clear separators. Each group should have a short title, a concise explanation, and structured controls such as Label, Input, Textarea, Switch, ToggleGroup, DropdownMenu, and Button. Keep the layout compact, readable, and tool-like. Use existing theme tokens, keep shadows minimal, separate destructive actions from normal settings, and avoid oversized decorative sections.
```

#### 弹窗表单模板 (Dialog Form Prompt Template)

```text
Design a Willow dialog-based form with shadcn-vue components from @willow/shadcn. Use DialogHeader, DialogTitle, DialogDescription, structured Label + Input/Textarea/Switch fields, and a stable DialogFooter with one primary confirm action plus secondary cancel. Prefer Input, Textarea, Select or DropdownMenu, Badge, and Card patterns that match Willow DESIGN.md. Keep the flow short, focused, and non-marketing; use concise helper text and avoid visual noise.
```

---

## Do's and Don'ts

### Do's

- **✔ 优先复用 shadcn 组件**：任何新需求，先检查 `@willow/shadcn` 下是否已提供原语，严禁自己编写重复的 input、dialog、select 等基础样式。
- **✔ 保持高信息密度**：在保证扫描性的前提下，适当减小组件 padding，增加单屏展示的信息量。
- **✔ 遵守 OKLCH 色值规范**：所有样式编写一律引用 CSS 变量（如 `var(--background)`），确保暗色模式下能自动无缝适配。
- **✔ 严格限定图标大小**：UI 图标必须限制在 `14px` 到 `18px` 之间，并在按钮 and 操作区居中对齐。

### Don'ts

- **❌ 严禁使用硬编码颜色**：不要在 Vue 组件的 `<style>` 或 Tailwind 类中写死十六进制色值（如 `bg-[#ffffff]` 或 `text-[#333333]`）。
- **❌ 严禁使用高饱和度大面积渐变**：不允许为了炫酷而引入大块彩色渐变背景。
- **❌ 严禁出现双重滚动条**：页面整体 `overflow: hidden`，必须滚动的区域必须包裹在 `scroll-area` 容器内。
- **❌ 严禁出现无 Tooltip 的孤立图标**：不要放置一个没有任何文字解释、悬浮也不显示 Tooltip 的图标按钮。
