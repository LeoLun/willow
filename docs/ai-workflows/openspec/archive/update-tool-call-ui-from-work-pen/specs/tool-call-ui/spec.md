# Tool Call UI Spec

## ADDED Requirements

### Requirement: Match The Tool Gallery Visual Reference

UI playground 的工具总览 SHALL 按 `ui/work.pen` 和用户提供截图还原工具展示样张，而不是只渲染真实工具 renderer。

#### Scenario: Render outer gallery section cards

- **GIVEN** 开发者打开工具总览 demo
- **WHEN** 页面展示任一工具分组
- **THEN** 该分组显示为大圆角浅色卡片
- **AND** 分组顶部包含英文工具标题
- **AND** 标题下方包含中文说明
- **AND** 标题说明与内容之间有横向分割线
- **AND** 卡片使用细边框和克制阴影

#### Scenario: Keep state specimens visible

- **GIVEN** 工具设计稿包含普通态、hover 态和展开态
- **WHEN** playground 渲染该工具 demo
- **THEN** 三种状态样张同时可见
- **AND** 用户不需要实际 hover 或点击才能看到 hover 态和展开态样张
- **AND** 样张可以复用真实 renderer 的小组件，但视觉结构必须匹配 UI 稿

### Requirement: Render Todo Gallery Like The Reference

Todo 工具总览 SHALL 按 UI 稿展示外层分组卡片、两个内层样张卡片和工具调用样张。

#### Scenario: Show todo group structure

- **GIVEN** 开发者打开工具总览中的 Todo 分组
- **WHEN** Todo 分组完成渲染
- **THEN** 外层卡片标题显示 `Todo`
- **AND** 外层说明显示 `任务列表类工具，适合检查计数、状态图标和展开明细。`
- **AND** 标题说明下方有横向分割线
- **AND** 内容区包含 `Todo Read` 和 `Todo Write` 两张内层卡片

#### Scenario: Show todo read specimen card

- **GIVEN** Todo Read 内层卡片完成渲染
- **WHEN** 用户查看该卡片
- **THEN** 内层标题显示 `Todo Read`
- **AND** 内层说明显示 `检查读取待办列表时的进度摘要和折叠明细。`
- **AND** 工具调用样张显示左侧列表图标
- **AND** 主动作显示 `读取待办列表`
- **AND** 右侧显示 `已完成` pill 和 chevron-right
- **AND** 摘要显示当前进行中任务
- **AND** 统计行显示完成数、进行中数和待处理数

#### Scenario: Show todo write specimen card

- **GIVEN** Todo Write 内层卡片完成渲染
- **WHEN** 用户查看该卡片
- **THEN** 内层标题显示 `Todo Write`
- **AND** 内层说明显示 `检查写入待办列表后的计数和状态图标层级。`
- **AND** 主动作显示 `更新待办列表`
- **AND** 右侧显示 `已完成` pill 和 chevron-right
- **AND** 摘要显示 `共 3 项待办`
- **AND** 统计行显示完成数和待处理数

### Requirement: Render Web Fetch Gallery Like The Reference

Web Fetch 工具总览 SHALL 按 UI 稿展示普通、hover、展开三态样张。

#### Scenario: Show web fetch group structure

- **GIVEN** 开发者打开工具总览中的 Web Fetch 分组
- **WHEN** Web Fetch 分组完成渲染
- **THEN** 外层标题显示 `Web Fetch`
- **AND** 外层说明显示 `抓取类工具，适合检查 URL 摘要、内容预览和参数面板。`
- **AND** 标题说明下方有横向分割线
- **AND** 内容区包含 `Web Fetch 工具状态` 样张区域

#### Scenario: Show web fetch normal hover and expanded specimens

- **GIVEN** Web Fetch 工具状态样张区域完成渲染
- **WHEN** 用户查看该区域
- **THEN** 普通态行显示弱化文字 `读取 vite.dev/config/server-options`
- **AND** hover 态行显示前景色文字 `读取 vite.dev/config/server-options` 和 chevron-right
- **AND** 展开态头部显示弱化文字 `读取 vite.dev/config/server-options` 和 chevron-down
- **AND** 展开态详情包含 `globe` 图标行 `vite.dev/config/server-options`
- **AND** 展开态详情包含 `circle-check` 图标行 `抓取完成`
- **AND** 展开态详情包含 `file-text` 图标行 `Markdown 内容预览`

### Requirement: Render Tool Calls As Compact Inline Cards

工具调用 SHALL 在聊天消息流中渲染为紧凑内联卡片，并遵守 `ui/work.pen` 与 `DESIGN.md` 的桌面工作台视觉约束。

#### Scenario: Show a stable inline card in assistant output

- **GIVEN** 助手消息中包含工具调用
- **WHEN** renderer 渲染该工具调用
- **THEN** 工具调用显示为带细边框、浅表面和紧凑内边距的内联卡片
- **AND** 卡片宽度跟随消息内容列，不突破为页面级展示区
- **AND** 卡片不使用大面积彩色背景、重阴影、渐变或营销化装饰

#### Scenario: Preserve surrounding message hierarchy

- **GIVEN** 同一条助手消息包含 Markdown 正文、思考状态、代码块和工具调用
- **WHEN** 消息完成渲染
- **THEN** 工具卡片与正文之间有稳定垂直间距
- **AND** 工具卡片不会遮挡或挤压正文、代码块、用量信息和流式状态

### Requirement: Support Normal Hover And Expanded States

可展开工具调用 SHALL 明确支持普通态、hover 态和展开态。

#### Scenario: Render normal state

- **GIVEN** 工具调用有动作摘要
- **WHEN** 卡片处于普通态
- **THEN** 主行展示工具动作摘要
- **AND** 主行文字使用弱化前景色
- **AND** 卡片展示当前状态，例如 `等待中`、`运行中`、`已完成` 或 `失败`

#### Scenario: Render hover affordance

- **GIVEN** 工具调用可展开
- **WHEN** 用户 hover 或聚焦卡片触发区
- **THEN** 主行文字强化为前景色
- **AND** 卡片显示或强化 `chevron-right` 入口提示
- **AND** hover 反馈只使用轻量颜色变化，不产生位移或强发光效果

#### Scenario: Render expanded state

- **GIVEN** 工具调用有可展示详情
- **WHEN** 用户展开卡片
- **THEN** 卡片显示 `chevron-down`
- **AND** 展开区域优先展示 2-3 行关键摘要
- **AND** 每个摘要行左侧使用 lucide 图标
- **AND** JSON、Markdown 或控制台输出位于摘要行之后的二级详情区

#### Scenario: Disable expansion when details are unavailable

- **GIVEN** 工具调用没有可展示详情
- **WHEN** 卡片完成渲染
- **THEN** 卡片不展示误导性的展开入口
- **AND** 点击卡片不会打开空白详情区域

### Requirement: Start Loading Sweep From ToolCallCard Loading Prop

`ToolCallCard` SHALL expose a `loading` input that starts a restrained sweep-light animation for in-progress tool calls.

#### Scenario: Show sweep when loading is enabled

- **GIVEN** 调用方渲染 `ToolCallCard`
- **WHEN** `loading` 入参为 `true`
- **THEN** 卡片显示克制的扫光动画
- **AND** 扫光位于工具卡片容器内
- **AND** 扫光不改变卡片宽高、圆角、边框、文本布局或展开区域布局
- **AND** 扫光不遮挡图标、标题、状态文案、chevron 和详情内容

#### Scenario: Keep card static by default

- **GIVEN** 调用方渲染 `ToolCallCard`
- **WHEN** 未传入 `loading` 或 `loading` 为 `false`
- **THEN** 卡片不显示扫光动画
- **AND** 现有普通态、hover 态、展开态和禁用态表现保持不变

#### Scenario: Let terminal states override loading

- **GIVEN** 工具调用已经完成、失败或被禁用
- **WHEN** renderer 渲染 `ToolCallCard`
- **THEN** renderer 不应继续传入 `loading=true`
- **AND** 失败态优先展示错误边框或错误状态
- **AND** 禁用态不显示可交互扫光反馈

#### Scenario: Enable sweep for running and pending renderers

- **GIVEN** Bash、Web Search、Web Fetch、Todo、Automation Create、Core Renderer 或 Default Fallback 处于 `running` 或 `pending`
- **WHEN** renderer 渲染工具卡片
- **THEN** renderer 可通过 `:loading="state === 'running' || state === 'pending'"` 启动扫光
- **AND** 完成态和失败态不显示扫光

#### Scenario: Preserve accessibility without animation dependence

- **GIVEN** 用户无法看到动画或偏好减少动态效果
- **WHEN** 工具卡片处于 loading 状态
- **THEN** 卡片仍通过状态文案表达 `运行中` 或 `等待中`
- **AND** 扫光不作为唯一状态来源

### Requirement: Render Bash Tool States

Bash 工具 SHALL 按设计稿展示成功态、失败态和输出详情。

#### Scenario: Show successful command summary

- **GIVEN** Bash 工具调用执行成功且参数包含 `command`
- **WHEN** Bash renderer 渲染
- **THEN** 普通态显示 `运行 <command>`
- **AND** 展开态包含 `terminal` 图标行展示原始命令
- **AND** 展开态包含 `circle-check` 图标行展示 `运行完成`
- **AND** 展开态包含 `file-text` 图标行展示 `控制台输出`

#### Scenario: Show failed command summary

- **GIVEN** Bash 工具调用执行失败
- **WHEN** Bash renderer 渲染
- **THEN** 卡片状态显示失败
- **AND** 展开态包含 `circle-x` 图标行展示 `运行失败`
- **AND** 展开态包含 `file-text` 图标行展示 `错误输出`
- **AND** 错误输出可查看但默认不铺满消息流

### Requirement: Render Web Search Tool States

Web Search 工具 SHALL 展示查询、结果数量、站点 pill 和结果摘要入口。

#### Scenario: Show search results summary

- **GIVEN** Web Search 工具调用有查询词和搜索结果
- **WHEN** Web Search renderer 渲染
- **THEN** 主行显示 `搜索 <query>`
- **AND** 卡片显示完成状态
- **AND** 卡片展示可见结果来源 pill
- **AND** 结果来源 pill 使用 host 摘要而不是完整 URL

#### Scenario: Show search expanded details

- **GIVEN** Web Search 工具有参数或结果详情
- **WHEN** 用户展开卡片
- **THEN** 展开区域包含 `search` 图标行展示查询词
- **AND** 展开区域包含 `list` 图标行展示结果数量
- **AND** 展开区域包含 `file-text` 图标行展示 `结果摘要`
- **AND** 参数和 Markdown 结果在二级详情区展示

### Requirement: Render Web Fetch Tool States

Web Fetch 工具 SHALL 展示目标地址、抓取状态和内容预览入口。

#### Scenario: Show fetch target summary

- **GIVEN** Web Fetch 工具调用包含 URL
- **WHEN** Web Fetch renderer 渲染
- **THEN** 主行显示 `读取 <host/path>`
- **AND** 长 URL 受控截断，不撑破消息列
- **AND** 卡片展示运行中、完成或失败状态

#### Scenario: Show fetch expanded details

- **GIVEN** Web Fetch 工具有参数或结果详情
- **WHEN** 用户展开卡片
- **THEN** 展开区域包含 `globe` 图标行展示目标 host/path
- **AND** 展开区域包含状态图标行展示 `抓取完成` 或 `抓取失败`
- **AND** 展开区域包含 `file-text` 图标行展示内容预览类型
- **AND** 长内容预览默认截断或放入受控详情块

### Requirement: Render Todo Tool States

Todo Read 和 Todo Write 工具 SHALL 展示任务统计和明细。

#### Scenario: Show todo read summary

- **GIVEN** 工具名为 `todoread`
- **WHEN** Todo renderer 渲染
- **THEN** 主行显示 `读取待办列表`
- **AND** 卡片展示任务总数
- **AND** 卡片展示完成、进行中、待处理统计

#### Scenario: Show todo write summary

- **GIVEN** 工具名为 `todowrite`
- **WHEN** Todo renderer 渲染
- **THEN** 主行显示 `更新待办列表`
- **AND** 卡片展示任务总数
- **AND** 卡片展示完成、进行中、待处理统计

#### Scenario: Show todo details

- **GIVEN** Todo 工具有任务明细
- **WHEN** 用户展开卡片
- **THEN** 展开区域展示任务列表
- **AND** 每个任务使用状态图标表达 completed、in_progress、pending 或 cancelled
- **AND** 已完成或取消任务使用弱化样式，进行中任务保持可扫的强调样式

### Requirement: Render Automation Create Tool States

Automation Create 工具 SHALL 以统一工具卡片展示创建结果。

#### Scenario: Show created automation summary

- **GIVEN** `automation_create` 工具调用成功且结果包含自动化详情
- **WHEN** Automation Create renderer 渲染
- **THEN** 主行显示 `创建「<title>」任务`
- **AND** 展开区域包含 `clock-3` 图标行展示自动化标题
- **AND** 展开区域包含 `calendar-clock` 图标行展示计划时间
- **AND** 展开区域包含 `circle-check` 图标行展示 `自动化已创建`

#### Scenario: Keep automation action secondary

- **GIVEN** Automation Create renderer 提供打开自动化详情的动作
- **WHEN** 卡片完成渲染
- **THEN** 打开动作使用次级按钮或图标按钮
- **AND** 该动作不会在视觉上高于工具状态和创建摘要

### Requirement: Render Core And Default Fallback Tools Consistently

Core Renderer 和 Default Fallback SHALL 使用统一降级卡片，避免空白或割裂展示。

#### Scenario: Show core renderer details

- **GIVEN** 工具调用使用 Core Renderer
- **WHEN** Core renderer 渲染
- **THEN** 主行优先显示 `getToolSummary` 生成的摘要
- **AND** 没有摘要时降级显示工具名
- **AND** 展开区域包含 `code` 图标行展示 core renderer 分类
- **AND** 展开区域包含 `braces` 图标行展示 `JSON 参数详情`

#### Scenario: Show unknown tool fallback

- **GIVEN** 工具调用没有专用 renderer
- **WHEN** Default Fallback renderer 渲染
- **THEN** 卡片显示实际工具名或 `渲染未知工具`
- **AND** 展开区域包含 `wrench` 图标行展示 `未识别工具`
- **AND** 展开区域包含 `file-text` 图标行展示 `默认降级渲染`
- **AND** 未知工具不会渲染为空标题或空白卡片

### Requirement: Register Available Tool Renderers In The Main App

主应用 SHALL 注册项目已有的专用工具 renderer，使聊天页使用真实工具 UI。

#### Scenario: Register automation renderer

- **GIVEN** 主应用启动 renderer
- **WHEN** 工具 renderer registry 初始化
- **THEN** `automation_create` 使用专用 Automation Create renderer
- **AND** 若打开详情动作暂不可用，renderer 仍能展示创建结果

#### Scenario: Keep existing todo renderer registration

- **GIVEN** 主应用启动 renderer
- **WHEN** 工具 renderer registry 初始化
- **THEN** `todoread` 和 `todowrite` 继续使用 Todo renderer
- **AND** 本次视觉改造不破坏待办工具结果展示

### Requirement: Keep Tool Approval UI Consistent

工具审批提示 SHALL 与新工具卡片视觉层级一致。

#### Scenario: Show pending approval above tool renderer

- **GIVEN** 工具调用需要审批
- **WHEN** `ToolMessage` 渲染审批状态
- **THEN** 审批提示显示在工具卡片上方
- **AND** 审批按钮使用 `@willow/shadcn` 的 `Button`
- **AND** 参数摘要保持紧凑，不抢占工具卡片主体层级

### Requirement: Update Playground Tool Demos

UI playground SHALL 覆盖本次工具 UI 的主要状态，作为实现阶段视觉验收入口。

#### Scenario: Show all tool demos in overview

- **GIVEN** 开发者启动 `pnpm dev:ui`
- **WHEN** 打开工具总览 demo
- **THEN** 页面展示 Bash、Web Search、Web Fetch、Todo、Automation Create、Core Renderer 和 Default Fallback
- **AND** demo 优先匹配 `work.pen` 的视觉样张结构
- **AND** demo 可以复用真实 `@willow/ui` renderer 或共享小组件
- **AND** demo 不得为了复用真实 renderer 而丢失 UI 稿中的状态样张

#### Scenario: Cover state variants

- **GIVEN** 开发者检查工具总览 demo
- **WHEN** 浏览各工具卡片
- **THEN** 可以看到成功态和失败态
- **AND** 可以看到可展开详情
- **AND** 至少一种工具展示 running 或 pending 状态
- **AND** running 或 pending 样张可展示 `ToolCallCard` 的 loading 扫光效果
- **AND** 长命令、长 URL 或长输出不会破坏布局

#### Scenario: Compare against visual reference before marking complete

- **GIVEN** 实现者准备勾选 playground 相关任务
- **WHEN** 进行验收
- **THEN** 必须对照 `ui/work.pen` 或用户提供截图检查外层卡片、内层卡片、状态样张、圆角、阴影、字号、间距和状态 pill 位置
- **AND** 仅构建通过或真实 renderer 可交互不得视为完成

### Requirement: Preserve Accessibility And Interaction Semantics

工具卡片 SHALL 保持键盘可操作、状态可辨识和文本可读。

#### Scenario: Expand with keyboard

- **GIVEN** 用户通过键盘聚焦可展开工具卡片
- **WHEN** 用户按 Enter 或 Space
- **THEN** 卡片展开或折叠
- **AND** focus 状态可见但克制

#### Scenario: Read state without color only

- **GIVEN** 工具调用处于运行中、完成或失败状态
- **WHEN** 用户查看卡片
- **THEN** 状态通过文字表达
- **AND** 图标或颜色只作为辅助，不作为唯一状态来源
