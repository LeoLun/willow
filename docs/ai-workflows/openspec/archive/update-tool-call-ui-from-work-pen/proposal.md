# update-tool-call-ui-from-work-pen

## Summary

根据 [`ui/work.pen`](/Users/liujinglun/code/willow/ui/work.pen) 中的 “Willow / Tool Calls Gallery” 与 “Willow / Chat Output Rich” 画板，更新项目里的工具调用展示 UI。范围覆盖 `@willow/ui` 工具 renderer、聊天消息中的工具内联卡片、工具状态文案、展开内容和 `app/ui-playground` 的工具 demo。

目标效果是让 Bash、Web Search、Web Fetch、Todo、Automation Create、Core Renderer 和 Default Fallback 都严格对齐 `work.pen` 的工具总览视觉：外层分组卡片、内层工具样张卡片、普通态 / hover 态 / 展开态三态展示，以及展开后的关键参数 / 结果摘要行。

## Correction Note

2026-04-29 的第一轮实现把重点放在“真实 renderer 统一为一个可交互卡片”上，但没有充分还原 `work.pen` 里工具总览页面的 UI 稿：

- Todo 分组应表现为大圆角分组卡片，包含 `Todo Read` / `Todo Write` 两张内层样张卡片，每张卡片内部才是工具调用样张。
- Web Fetch 分组应展示普通态、hover 态、展开态三条状态样张，而不是只渲染一个可交互真实卡片。
- 工具总览 demo 的视觉验收应优先以 `work.pen` 截图级还原为准，再考虑真实聊天消息里的交互复用。

因此本 OpenSpec 继续推进同一 change，但需要把 UI 稿还原作为硬性要求补充到 `design.md`、`spec.md` 和 `tasks.md`。

## Problem

当前工具展示已经有基础 renderer，但和 `work.pen` 的目标稿仍存在明显差距：

- Bash 仍以 `ToolHeader + ConsoleBlock` 为主，和其它工具的紧凑内联卡片不一致。
- Web Search / Web Fetch / Todo / Default 已有折叠卡片，但信息层级、hover 入口、展开摘要行和视觉密度尚未完全对齐设计稿。
- Automation Create 在主应用中仍未注册，且展示更像结果横幅，不符合工具调用统一状态模型。
- Core Renderer 与 Default Fallback 的 fallback 体验不一致，未知工具与通用工具缺少统一降级语义。
- `app/ui-playground` 的工具 demo 需要同步展示设计稿中的普通态、hover 态、展开态和边界状态，否则后续视觉验收缺少稳定入口。
- 第一轮实现暴露出一个额外问题：如果只复用真实 renderer，playground 无法表达 UI 稿要求的“普通 / hover / 展开三态并列样张”，导致验收画面和设计稿不一致。

## Goals

- 将工具调用展示统一为 `work.pen` 中的紧凑内联卡片模型。
- 为 Bash、Web Search、Web Fetch、Todo、Automation Create、Core Renderer、Default Fallback 明确各自展示内容。
- 所有可展开工具都提供普通态、hover 态、展开态，并使用 lucide 图标行表达关键参数与结果摘要。
- `ToolCallCard` 支持通过 `loading` 入参启动克制扫光效果，用于表达运行中或等待中的工具调用。
- 聊天会话正文中的工具调用保持内联小卡片形态，和 Markdown 正文、思考块、代码块共存时层级稳定。
- `app/ui-playground` 增加或更新工具总览 demo，使开发者能一次性检查各工具状态。
- `app/ui-playground` 的工具总览必须先按 `work.pen` 还原静态/半静态状态样张，再把真实 renderer 作为实现来源或对照对象。
- 遵守 [`DESIGN.md`](/Users/liujinglun/code/willow/DESIGN.md) 的桌面工作台 UI 约束，复用现有 token、`@willow/shadcn` 和 lucide 图标。

## Non-Goals

- 本次不改 agent 工具执行协议、主进程执行逻辑或工具权限策略。
- 本次不新增真实工具能力，只更新已有工具调用的展示层与 demo 数据。
- 本次不重做聊天页整体布局、左侧栏、右侧栏或输入器。
- 本次不引入独立主题、品牌色、重阴影或营销化展示页。
- 本次不要求引入自动化视觉回归平台；手动 playground 验证即可作为实现阶段基线。

## Success Criteria

- `@willow/ui` 中相关工具 renderer 对齐 `work.pen` 的卡片骨架、字号、间距、状态和展开内容。
- Bash 成功态和失败态都能展示命令摘要、完成 / 失败状态与控制台输出入口。
- Web Search 展示查询摘要、完成状态、站点 pill 和结果摘要；Web Fetch 展示目标 URL / host、抓取完成状态和内容预览入口。
- Todo Read / Todo Write 展示任务总数、完成数、进行中数、待处理数，并在展开态展示任务明细。
- Automation Create 展示自动化标题、计划时间、创建结果，并可在主应用中以专用 renderer 注册。
- Core Renderer 和 Default Fallback 使用统一降级卡片，能展示工具名、参数 / JSON 详情和结果状态。
- `app/ui-playground` 的工具总览覆盖普通态、hover 态、展开态、成功态、失败态、运行中或 pending 态。
- 运行中或 pending 的工具卡片可通过 `loading` prop 显示扫光，完成、失败、禁用和无 loading 配置时不显示扫光。
- 扫光效果不会遮挡标题、图标、状态文案、chevron 或展开详情，不改变卡片布局尺寸，也不引入独立主题色。
- `app/ui-playground` 的工具总览在视觉结构上与 `work.pen` 截图一致：分组标题、说明、分割线、外层分组卡片、内层工具样张卡片、工具调用样张的字号、留白、圆角、阴影和状态位置都应匹配。
- 最终实现通过相关 lint / build 检查，并通过 `pnpm dev:ui` 进行手动视觉验收。

## Viable Approaches

### Approach A: 抽取统一 Tool Call Card 基座，再逐个 renderer 填充内容

在 `packages/ui` 内抽取轻量的工具卡片基座，例如统一的触发区、状态 badge、chevron、展开内容行和详情区。各 renderer 只负责提供工具类型、标题、摘要行、状态和展开内容。

优点：

- 最容易保持 Bash、Web、Todo、Automation 与 fallback 的视觉一致性。
- 后续新增工具 renderer 时可直接复用统一骨架。
- playground 中普通 / hover / 展开态可以复用同一真实组件。

缺点：

- 需要先梳理现有 renderer 差异，初始改动范围略大。
- 基座 API 设计过度抽象会增加维护成本，需要保持克制。

### Approach B: 保持每个 renderer 独立实现，仅逐个微调样式

不抽取共用组件，直接在每个现有 renderer 内按 `work.pen` 调整结构、class 和内容映射。

优点：

- 单个文件改动直观，短期实现速度快。
- 不需要设计新的共享组件 API。

缺点：

- 多个 renderer 容易再次漂移，hover、展开、状态文案和间距难以长期一致。
- Core / Default / Bash 这类通用路径会继续重复实现折叠逻辑。

### Approach C: 只更新 playground demo，不调整真实 renderer

仅把 `app/ui-playground` 做成接近 `work.pen` 的视觉展示页，把真实聊天工具 renderer 留到后续再改。

优点：

- 最快得到静态视觉对照页面。
- 对主应用运行风险最小。

缺点：

- 不满足“更新项目中工具展示的 UI 效果”的真实产品目标。
- demo 和实际聊天页会产生平行实现，后续更难对齐。

### Approach D: 先还原 `work.pen` 工具总览样张，再回收真实 renderer 复用点

把 `app/ui-playground` 的工具总览视为设计稿还原页面：它可以使用真实 renderer 的数据和局部组件，但必须能显式渲染普通态、hover 态、展开态三种样张。真实聊天里的 renderer 再基于同一视觉 token / 小组件复用，不强迫一个交互组件同时承担所有设计样张。

优点：

- 最符合用户提供的 UI 稿和截图验收方式。
- 可以清楚区分“设计状态样张”和“真实聊天交互组件”，避免真实交互限制设计还原。
- 后续仍可逐步提炼公共小组件，减少重复。

缺点：

- playground 里会有少量专用于状态样张的展示组件。
- 需要额外做截图/肉眼对比，不能只靠构建通过判断完成。

### Loading Sweep Addendum

`ToolCallCard` 的扫光能力有三种可行实现：

1. 卡片根容器伪元素扫光：在根节点开启 `position: relative` 与 `overflow: hidden`，`loading` 为真时用 `::after` 渲染低透明度斜向高光。
2. 标题文字扫光：复用现有 `animate-shimmer` 文本渐变，只让标题文字闪动。
3. 新增独立 `loading` slot：由调用方传入自定义扫光或 loading 内容。

推荐采用第 1 种。它最符合“工具卡片正在执行”的整体反馈语义，调用方只需要配置 `loading` 入参，且不会把扫光逻辑泄漏到每个 renderer。第 2 种反馈面积过小，容易和标题 hover 状态混淆；第 3 种 API 过重，容易让不同工具再次产生视觉漂移。

## Recommendation

采用 Approach D，并保留 Approach A 中“克制复用”的原则。下一轮实现应先还原 `work.pen` 工具总览的视觉样张，尤其是 Todo 与 Web Fetch 截图中的层级、间距、圆角、阴影、状态 pill 和三态排列；再把真实 renderer 调整到同一视觉语言。

## Next Step

进入 `workflow-plan`，基于本变更写出实现计划，明确文件改动顺序、视觉验收方式和验证命令。
