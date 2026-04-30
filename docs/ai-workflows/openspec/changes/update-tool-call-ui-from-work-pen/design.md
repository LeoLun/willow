# Design

## Scope

本次设计覆盖：

- `packages/ui/src/renderers/*` 中工具调用 renderer 的视觉骨架与展示内容。
- `packages/ui/src/components/ToolMessage.vue` 中工具审批与工具 renderer 的组合层级。
- `app/work/src/renderer/src/App.vue` 中主应用工具 renderer 注册策略。
- `app/ui-playground/src/demos/*` 中工具 demo 数据、场景导航和总览页。

本次不覆盖：

- agent 工具执行协议、工具结果 schema 的后端定义。
- Electron 主进程工具执行与权限审批策略。
- 聊天页整体布局、右侧栏、输入器或 Markdown 渲染体系的大范围重构。

## Source Reference

以 [`ui/work.pen`](/Users/liujinglun/code/willow/ui/work.pen) 为视觉参考，重点节点如下：

- `Willow / Tool Calls Gallery`：完整工具调用总览。
- `Willow / Chat Output Rich`：工具调用嵌入会话输出流时的整体效果。

设计稿中的核心模式：

- 页面壳为桌面工作台风格，左侧 sidebar，主内容为浅色 `card/background` 面。
- 工具总览按 Bash、Web、Todo / Automation、Core / Default 分组。
- 每个工具卡片使用浅表面、细边框、克制阴影和紧凑内边距。
- 工具调用本体在聊天输出中是内联小卡片，而不是大块调试面板。
- 每类工具展示普通态、hover 态、展开态；hover 态文字变为前景色并显示 chevron-right；展开态显示 chevron-down 和 2-3 行关键摘要。

## Visual Fidelity Contract

本次变更的验收以 `work.pen` 工具总览画板和用户提供截图为准。`app/ui-playground` 不是只要“能显示工具 renderer”即可，它必须还原 UI 稿里的视觉样张结构。

### Tool Gallery Section

每个工具分组必须表现为设计稿中的大分组卡片：

- 外层分组卡片使用浅背景、细边框、较大圆角和克制阴影。
- 分组顶部包含英文工具标题，例如 `Todo`、`Web Fetch`。
- 标题下方是中文说明，字体明显大于普通辅助小字，颜色为 muted。
- 标题说明与内容之间有一条横向分割线。
- 分组内容区按设计稿组织内层样张卡片或状态样张行，不得直接堆一个真实 renderer 后结束。

### Inner Sample Card

Todo、Bash、Automation 等存在内层样张卡片的工具必须使用内层卡片：

- 内层样张卡片有自己的标题与说明，例如 `Todo Read`、`Todo Write`。
- 内层卡片使用白色/浅色表面、大圆角、细边框和轻阴影。
- 内层工具调用样张位于标题说明下方，并占满卡片内容宽度。
- Todo 截图中的工具调用样张必须体现左侧列表图标、主动作、右侧状态 pill、右侧 chevron、粗体摘要和统计行。

### State Specimen Rows

Web Fetch 截图展示的是状态样张，而不是单个交互卡片。此类工具总览必须显式渲染：

- 普通态：弱化文字，例如 `读取 vite.dev/config/server-options`。
- Hover 态：前景色文字 + `chevron-right`。
- 展开态头部：弱化文字 + `chevron-down`。
- 展开态详情行：`globe` / `circle-check` / `file-text` 图标 + 对应文本。

这三态样张必须同时可见，不能只依赖真实 hover 行为让用户自己触发。

## Visual Principles

### Principle: 工具调用是消息流的一部分

工具卡片应当能自然嵌入助手消息流：

- 默认宽度填满消息内容列，而不是突破为页面级区域。
- 使用 `rounded-lg` / `rounded-md`、`border-border`、`bg-card` 或 `bg-background`。
- 保持 12-14px 主体文字，状态与辅助信息使用 11-12px。
- 不使用大面积彩色背景、强阴影或装饰性渐变。

注意：聊天消息里的真实工具调用可以是内联卡片，但 playground 工具总览的样张不等同于真实聊天消息。总览页应优先还原设计稿的状态陈列方式。

### Principle: 状态先于调试细节

用户第一眼应看到“工具做了什么”和“是否完成”，而不是先看到 JSON。

每个工具默认展示：

- 工具动作摘要，例如 `运行 pnpm lint`、`搜索 OpenAI API 文档`、`读取 vite.dev/config/server-options`。
- 状态 badge，例如 `运行中`、`已完成`、`失败`、`等待中`。
- 能展开时显示 chevron；不能展开时保持无误导的静态行。

展开内容展示：

- 关键参数或结果摘要行，每行左侧使用 lucide 图标。
- 只展示 2-3 条最能帮助用户理解的摘要。
- JSON、Markdown、控制台输出放在二级详情块中，避免默认压住消息流。

### Principle: 每个 renderer 填业务内容，共享视觉骨架

推荐新增或整理一个共享工具卡片基座组件，提供：

- 根容器表面、边框、紧凑 padding。
- 可点击触发区、hover 状态、chevron 旋转。
- 状态 badge。
- 展开内容 slot。
- 禁用展开时的受控行为。

各 renderer 负责：

- 工具类型图标。
- 主标题 / 动作摘要。
- 状态映射。
- 摘要行内容。
- 可选详情块，如 console、CodeBlock、Markdown preview。

共享基座不得变成过度复杂的 schema renderer；它只服务本次重复出现的卡片交互与视觉结构。

### Loading Sweep

`ToolCallCard` 需要提供一个显式 `loading?: boolean` 入参，用于启动工具卡片的扫光效果。调用方应在工具处于 `running` 或 `pending` 时传入 `loading`，完成态、失败态、禁用态和静态样张默认不启用。

扫光设计要求：

- 扫光属于卡片根容器的轻量状态反馈，而不是标题文字特效或额外 loading 文案。
- 效果应使用现有 token，例如 `foreground` / `muted-foreground` / `background` 的低透明度组合，不新增品牌色或平行主题变量。
- 扫光层应在卡片内容下方或使用 `pointer-events: none`，不得遮挡点击、hover、focus、展开、审批按钮或详情内容。
- 动画不改变卡片尺寸、圆角、边框、阴影和文本布局。
- `error` 为真或 `disabled` 为真时，视觉优先级高于 loading；实现阶段应避免失败卡片继续扫光。
- 若运行环境或用户偏好禁用动画，卡片仍应通过状态文案表达 `运行中` / `等待中`，扫光只作为增强反馈。

实现上优先使用 `ToolCallCard` 内部伪元素或内部装饰层，避免每个 renderer 手写扫光结构。现有 `packages/ui/src/style.css` 中的 `shimmer` 动画可以作为节奏参考，但最终样式应局部收敛在 `ToolCallCard.vue`，不要把工具卡片状态变成全局 UI 约定。

## Tool-Specific Design

### Bash

Bash renderer 应从独立 `ToolHeader + ConsoleBlock` 调整为统一工具卡片：

- 普通态：`运行 <command>`，文字为 `muted-foreground`。
- Hover 态：文字转为 `foreground`，右侧或文字后显示 `chevron-right`。
- 展开态：显示 `chevron-down`，下方摘要行包含：
  - `terminal`：原始命令，例如 `pnpm lint`。
  - 成功时 `circle-check` + `运行完成`；失败时 `circle-x` + `运行失败`。
  - `file-text`：`控制台输出` 或 `错误输出`。
- 输出内容可继续使用 `ConsoleBlock`，但应作为展开态详情，不在默认态直接铺开。

### Web Search

Web Search renderer 应保持站点 pill 能力，并补齐设计稿的摘要层级：

- 主行：`搜索 <query>`，运行中显示搜索中状态，完成显示 `已完成`，错误显示 `失败`。
- 结果 pill：展示可见 host，例如 `github.com`、`docs.local`，超过可见数量显示 `+N`。
- 展开摘要行包含：
  - `search`：查询词。
  - `list`：结果数量，例如 `2 条搜索结果`。
  - `file-text`：`结果摘要`。
- 详细输出中的参数和 Markdown 结果继续使用 `CodeBlock` 或现有详情块，但层级必须低于摘要行。

### Web Fetch

Web Fetch renderer 应突出目标页面与抓取状态：

- 主行：`读取 <host/path>`。
- 状态 badge：运行中 / 已完成 / 失败 / 等待中。
- 展开摘要行包含：
  - `globe`：host/path。
  - `circle-check` 或错误图标：`抓取完成` / `抓取失败`。
  - `file-text`：`Markdown 内容预览`、`HTML 内容预览` 或 `文本内容预览`。
- 长内容预览继续截断，避免撑高消息流。

### Todo Read / Todo Write

Todo renderer 应保留任务统计，并按 read/write 展示不同动作文案：

- `todoread` 主行：`读取待办列表`。
- `todowrite` 主行：`更新待办列表`。
- 默认卡片展示当前摘要，例如 `共 3 项待办` 或当前进行中任务。
- 辅助行展示 `2/3 · 1 项进行中 · 1 项待处理`。
- 展开摘要行或明细列表包含：
  - `list-checks`：任务总览或当前重点任务。
  - `circle-check`：已完成数。
  - `circle-dot`：进行中数。
  - `circle`：待处理数。
- 任务明细仍应使用状态图标和紧凑行距，不需要彩色大块背景。

### Automation Create

Automation Create renderer 应采用统一工具卡片，不再表现为独立结果横幅：

- 主行：`创建「<title>」任务`。
- 展开摘要行包含：
  - `clock-3`：自动化标题。
  - `calendar-clock`：计划表达，例如 `每天 18:00`。
  - `circle-check`：`自动化已创建`。
- 如存在打开自动化详情的动作，应使用克制的 secondary / outline 小按钮或图标按钮，不应抢占工具状态主层级。
- 主应用需要注册 `automation_create` renderer；若暂时无法打开自动化页，也必须保证 renderer 展示可用。

### Core Renderer

Core Renderer 用于已知但没有专用 UI 的通用工具：

- 主行来自 `getToolSummary`，没有摘要时降级到工具名。
- 展开摘要行包含：
  - `code`：工具类型或 renderer 分类，例如 `renderer: core`。
  - `braces`：`JSON 参数详情`。
- 参数和输出继续以 `CodeBlock` 呈现，但不要默认展开。

### Default Fallback

Default Fallback 用于未知工具：

- 主行优先显示 `渲染未知工具` 或实际工具名。
- 展开摘要行包含：
  - `wrench`：`未识别工具`。
  - `file-text`：`默认降级渲染`。
- 必须保证未知工具不会显示空标题或空白卡片。

## Tool Approval Design

`ToolMessage.vue` 中的审批提示仍需保留，但应与工具卡片层级协调：

- 审批提示位于工具卡片上方。
- 使用 `@willow/shadcn` 的 `Button` 替代原生按钮。
- 审批参数摘要保持紧凑，不抢占工具 renderer 主体。
- 高风险提示仍使用 amber 语义，但面积和文字保持克制。

## Playground Design

`app/ui-playground` 应作为实现阶段主要视觉验收入口：

- 保留“全部工具总览”场景。
- 每个工具 demo 必须按 `work.pen` 还原分组卡片、内层样张卡片和状态样张行。
- 可以复用真实 `@willow/ui` renderer 的数据解析、小组件或样式 token，但不得牺牲 UI 稿结构。
- 当真实 renderer 无法表达普通 / hover / 展开三态同时可见时，应在 playground 中提供专门的状态样张组件。
- demo 数据覆盖：
  - Bash 成功 / 失败。
  - Web Search 有结果 / 可展开。
  - Web Fetch 有目标 URL / 内容预览。
  - Todo Read / Todo Write。
  - Automation Create。
  - Core Renderer。
  - Default Fallback。
  - 至少一种 running 或 pending 状态。
- 运行中或 pending 样张需要覆盖 `ToolCallCard` 的 `loading` 扫光状态。
- 总览页自身遵守 `DESIGN.md`：紧凑、可扫描、浅表面、细边框，不做营销展示。

### Required Visual Specimens

Todo 分组必须至少包含：

- 外层 `Todo` 分组卡片。
- `Todo Read` 内层样张卡片。
- `Todo Write` 内层样张卡片。
- 每张内层卡片中的工具调用样张：左侧图标、动作标题、右侧 `已完成` pill、右侧 chevron、粗体摘要、统计行。

Web Fetch 分组必须至少包含：

- 外层 `Web Fetch` 分组卡片。
- `Web Fetch 工具状态` 内层区域。
- 普通、hover、展开三态文本行。
- 展开态详情行：目标 URL、抓取完成、Markdown 内容预览。

## Data And Compatibility

- 工具 renderer 必须继续接受当前 `ToolCall.arguments` 与 `ToolResultMessage.details/content` 数据结构。
- 参数可能是对象、JSON 字符串或空值，renderer 需要受控降级。
- 工具结果可能缺少 details，默认卡片仍应显示工具名和状态。
- 长命令、长 URL、长标题必须 truncate 或换行受控，不能撑破消息列。
- i18n 文案应补齐中英文键值；中文优先符合当前 renderer 文案风格。

## Risks And Mitigations

### Risk: 共享基座抽象过大

Mitigation：只抽取容器、触发区、状态 badge、chevron 和 slot，不把各工具业务字段塞进统一 schema。

### Risk: 工具卡片默认信息过少，用户需要频繁展开

Mitigation：默认态至少展示动作摘要和状态；Todo / Web Search 可以保留一行关键统计或站点 pill。

### Risk: 详情内容撑高消息流

Mitigation：默认折叠详情；长输出使用现有 `CodeBlock` / `ConsoleBlock` 的滚动或截断策略。

### Risk: playground 和主应用展示漂移

Mitigation：playground 必须消费真实 `@willow/ui` 组件和 renderer registry，不写平行静态实现。

### Risk: 真实 renderer 复用导致无法还原设计稿

Mitigation：允许 playground 使用专门的状态样张组件。样张组件必须复用 token、图标和基础展示组件，但不必强制等同于真实聊天里的可交互 renderer。
