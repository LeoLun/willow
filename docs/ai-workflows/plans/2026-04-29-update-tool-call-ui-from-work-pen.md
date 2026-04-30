# 2026-04-29 update-tool-call-ui-from-work-pen

## Revision Note

本计划取代上一版 renderer-first 执行计划。上一版把真实聊天 renderer 的统一卡片作为主线，导致 `app/ui-playground` 的工具总览没有按 `ui/work.pen` 和用户截图还原 Todo、Web Fetch 等工具样张。

本轮实施顺序改为：先恢复工具总览的 UI 稿样张，再回收真实 renderer 的复用点。`app/ui-playground` 可以存在专门的样张组件，用于同时展示普通态、hover 态、展开态；不能为了复用真实交互组件而丢失 UI 稿结构。

## Goal

基于 `update-tool-call-ui-from-work-pen` OpenSpec 的修正版，更新项目中的工具展示 UI。实施完成后：

- `app/ui-playground` 工具总览首先截图级对齐 `ui/work.pen` 中的 tool 样式；用户提供截图只作为同一设计稿的辅助确认，不替代 `work.pen`。
- Todo 分组恢复外层大卡片、分割线、`Todo Read` / `Todo Write` 内层样张卡片，以及样张内的图标、状态 pill、chevron、粗体摘要和统计行。
- Web Fetch 分组恢复外层大卡片、`Web Fetch 工具状态` 内层区域、普通 / hover / 展开三态同时可见，以及 `globe` / `circle-check` / `file-text` 详情行。
- `ToolCallCard` 增加 `loading?: boolean` 入参，通过配置启动克制扫光效果，用于 running / pending 工具调用。
- 真实 `@willow/ui` renderer 在样张恢复后再与同一视觉语言对齐，保留聊天消息里的内联交互形态。

## OpenSpec Inputs

- `docs/ai-workflows/openspec/changes/update-tool-call-ui-from-work-pen/proposal.md`
- `docs/ai-workflows/openspec/changes/update-tool-call-ui-from-work-pen/design.md`
- `docs/ai-workflows/openspec/changes/update-tool-call-ui-from-work-pen/tasks.md`
- `docs/ai-workflows/openspec/changes/update-tool-call-ui-from-work-pen/specs/tool-call-ui/spec.md`
- `DESIGN.md`
- `ui/work.pen`
- 用户本轮提供的 Todo 与 Web Fetch 截图

## Work.pen Tool Style Contract

实现必须以 `ui/work.pen` 的 tool 节点为准，不能用“看起来更清楚”的放大版样式替代设计稿。关键节点包括：

- `Willow / Tool Calls Gallery` (`ltd7B`)
- `Tool gallery body` (`6W0WF`)
- `Bash Success Card` (`DjM2n`)
- `Bash Failure Card` (`hFcSD`)
- `Web Fetch Block` (`NlgDB`) / `Fetch Result Card` (`d7fMa`)
- `todoReadCard` (`O8p5i`)
- `todoWriteCard` (`i1eCD3`)
- `autoCard` (`ZUFmI`)
- `Core Renderer Block` (`o4nR2`)
- `Default Fallback Block` (`WLzHk`)
- `Message canvas` (`cG5jn`) for inline chat output proportions

Style values to preserve when translating to Vue utility classes:

- Gallery body: `gap: 20`, `padding: 24`.
- Outer section card: `cornerRadius: 18`, `padding: 24`, `gap: 20/28`, `border: 1px`, subtle shadow `0 2px 8px #0000001a`.
- Section title: Inter, `22px`, `700`; section description: `16px`, `600`, muted.
- Divider: `1px` full width, border color.
- Inner sample card: `cornerRadius: 16`, `padding: 18`, `gap: 14`, `border: 1px`, subtle shadow `0 2px 6px #00000014`, card surface.
- Inner card title: `18px`, `700`; inner card description: `15px`, `600`, muted.
- Tool state rows: `14px`, `500`, `line-height: 1.4286`, row height about `22px`, horizontal gap `6`.
- Detail rows: icon size `14px`, text `14px`, row gap `8`, vertical gap `5`.
- Normal and expanded header text: weak muted foreground (`#a3a3a3` in resolved light theme).
- Hover specimen text: foreground (`#0a0a0a` in resolved light theme) plus `chevron-right`.
- Expanded specimen header: weak muted text plus `chevron-down`.
- Loading sweep: contained in the tool card surface, low-contrast, pointer-events none, no layout shift, no new brand color.
- Do not upscale the tool specimens to 20-28px row text, 24-28px cards, or oversized icons; that drifts from `work.pen`.

## Current Code Anchors

优先检查和修改：

- `app/ui-playground/src/demos/scenes/AllToolsOverviewDemo.vue`
- `app/ui-playground/src/demos/scenes/TodoToolDemo.vue`
- `app/ui-playground/src/demos/scenes/WebFetchToolDemo.vue`
- `app/ui-playground/src/demos/mock-data.ts`
- 可新增 `app/ui-playground/src/demos/components/*` 样张组件

随后对齐真实 renderer：

- `packages/ui/src/components/ToolCallCard.vue`
- `packages/ui/src/style.css` only if a shared animation token is reused; prefer keeping card-specific sweep styles scoped in `ToolCallCard.vue`.
- `packages/ui/src/components/ToolCallDetailRow.vue`
- `packages/ui/src/components/ToolMessage.vue`
- `packages/ui/src/renderers/BashToolRenderer.vue`
- `packages/ui/src/renderers/WebSearchToolRenderer.vue`
- `packages/ui/src/renderers/WebFetchToolRenderer.vue`
- `packages/ui/src/renderers/TodoToolRenderer.vue`
- `packages/ui/src/renderers/AutomationCreateToolRenderer.vue`
- `packages/ui/src/renderers/CoreToolRenderer.vue`
- `packages/ui/src/renderers/DefaultToolRenderer.vue`
- `packages/ui/src/index.ts`
- `app/work/src/renderer/src/App.vue`

## Assumptions

- 当前工作区已有上一轮实现残留，不能把这些改动视为正确基线；实施时要逐项对照 UI 稿决定复用、调整或替换。
- 不回退用户或其他流程产生的文件改动，尤其是 `ui/work.pen`、`DESIGN.md` 和无关工作区变更。
- `app/ui-playground` 的工具总览是本次视觉验收主入口，允许使用专用 specimen 组件表达 UI 稿状态。
- 真实聊天 renderer 仍应是可交互内联卡片，但它不需要承担“普通 / hover / 展开三态并列展示”的样张职责。
- `loading` 扫光只作为状态增强；状态文案仍是 running / pending 的主要可读表达。
- 失败、完成、禁用的工具卡片不应继续显示扫光，即使上游状态切换较晚也要在 renderer 层避免误传。
- Vue 文件继续使用 `<script setup lang="ts">`，样式复用现有 token、UnoCSS utility、`@willow/shadcn` 和 `lucide-vue-next`。

## Dependencies

- 先读取 `DESIGN.md`，确认桌面工作台 UI 约束：克制阴影、浅表面、细边框、紧凑可扫描，不做营销式大块装饰。
- 样张组件使用 lucide 图标，不手写一套 icon。
- 圆角、阴影、字号、间距、pill 位置以 `ui/work.pen` 和用户截图为准；构建通过不能替代视觉对照。
- 若真实 renderer 里已有 `ToolCallCard` / `ToolCallDetailRow`，实施阶段需检查其视觉是否能支持样张需求，不能强行套用导致 UI 稿走样。
- 当前 playground 样张组件若出现明显大于 `work.pen` 的字号、圆角、padding 或图标尺寸，应先收敛到上方 Style Contract。
- 扫光优先在 `ToolCallCard.vue` 内以伪元素或内部装饰层实现；不要要求每个 renderer 手写扫光 DOM。

## Blockers And Escalation Rules

- 如果 UI 稿样张与真实 renderer 交互模型冲突，优先保证 playground 样张还原；真实 renderer 另做同语言对齐。
- 如果缺少截图 / browser 验证能力，不标记 `tasks.md` 中 5.4、5.5、5.6、6.3、6.5 为完成，只记录可运行入口和待人工验收项。
- 如果动画实现与可访问性或 reduced-motion 约束冲突，先保留 `loading` prop 和静态状态文案，回到 `workflow-spec` 补充动画策略后再继续视觉增强。
- 如果某个样张需要的数据当前 mock 缺失，先补 mock；不改工具执行协议。
- 如果需要新增设计要求才能决定样张内容，回到 `workflow-spec`，不要在实现里自造产品语义。
- 如果 lint/build 暴露大量无关历史问题，记录范围，只修本次触达文件导致的问题。

## Execution Slices

### Slice 1: 稳住现状并读取视觉基准

目标：

- 明确上一轮实现残留和修正后 OpenSpec 的差异，避免继续沿旧计划实施。

涉及文件 / 子系统：

- `docs/ai-workflows/openspec/changes/update-tool-call-ui-from-work-pen/*`
- `DESIGN.md`
- `ui/work.pen`
- `app/ui-playground/src/demos/scenes/*`
- `packages/ui/src/renderers/*`

实施步骤：

1. 读取修正后的 `proposal.md`、`design.md`、`spec.md`、`tasks.md`，以 `Visual Fidelity Contract` 和新增 Gallery requirements 为准。
2. 读取 `DESIGN.md`，确认工具型桌面界面的颜色、密度、组件约束。
3. 检查当前 git diff，标出上一轮已改但可能偏离 UI 稿的文件。
4. 对照用户截图记录 Todo 和 Web Fetch 的固定视觉结构：外层卡片、内层卡片、标题、说明、分割线、状态行、图标、pill、chevron、阴影和留白。

验证：

- 确认实施清单优先指向 playground 样张，而不是直接继续 renderer-first 改造。

停手条件：

- 如果 OpenSpec 与用户截图仍有矛盾，先回到 `workflow-spec`；否则进入 Slice 2。

### Slice 2: 建立 playground 样张基础组件

目标：

- 为工具总览恢复 UI 稿结构，提供只服务样张陈列的轻量组件。

涉及文件 / 子系统：

- 新增或调整 `app/ui-playground/src/demos/components/ToolGallerySection.vue`
- 新增或调整 `app/ui-playground/src/demos/components/ToolSampleCard.vue`
- 新增或调整 `app/ui-playground/src/demos/components/ToolStateRows.vue`
- `app/ui-playground/src/demos/scenes/AllToolsOverviewDemo.vue`

实施步骤：

1. 实现 `ToolGallerySection`：外层大卡片、英文标题、中文说明、横向分割线、内容 slot。
2. 实现 `ToolSampleCard`：内层样张卡片、标题、说明、轻阴影、内容宽度填满。
3. 实现 `ToolStateRows` 或等价组件：支持普通态、hover 样张态、展开态头部和详情行同时可见。
4. 所有组件只负责视觉容器，不绑定真实工具协议。
5. 将 `ToolGallerySection` / `ToolSampleCard` / `ToolStateRows` 的字号、padding、圆角、阴影和图标尺寸按 `Work.pen Tool Style Contract` 校准，尤其避免当前组件中 `text-xl`、`text-[24px]`、`text-[28px]` 造成的放大漂移。
6. 在 `AllToolsOverviewDemo.vue` 中调整布局，避免给已经是外层卡片的工具分组再套一层额外大卡片。

验证：

- 样张组件自身能表达 Todo 截图和 Web Fetch 截图要求的结构。
- 页面没有多余嵌套卡片导致阴影、边框、间距比 UI 稿更重。
- 与 `work.pen` 对比时，工具样张主文本应接近 14px，内层标题接近 18px，外层标题接近 22px。

停手条件：

- 样张基础组件可复用到 Todo 和 Web Fetch，且没有引入平行主题变量。

### Slice 3: 恢复 Todo 工具总览 UI

目标：

- `TodoToolDemo.vue` 按用户截图恢复完整 Todo 分组。

涉及文件 / 子系统：

- `app/ui-playground/src/demos/scenes/TodoToolDemo.vue`
- `app/ui-playground/src/demos/mock-data.ts`
- 样张组件

实施步骤：

1. 使用 `ToolGallerySection` 渲染外层 `Todo` 分组。
2. 添加分组说明：`任务列表类工具，适合检查计数、状态图标和展开明细。`
3. 在内容区渲染两张 `ToolSampleCard`：`Todo Read` 和 `Todo Write`。
4. 每张内层卡片包含工具调用样张：左侧 `list-checks` 图标、主动作标题、右侧 `已完成` pill、右侧 `chevron-right`。
5. `Todo Read` 样张内容使用粗体摘要 `为每一种工具调用补充 demo`，统计行 `1/3 · 1 项进行中 · 1 项待处理`。
6. `Todo Write` 样张内容使用粗体摘要 `共 3 项待办`，统计行 `2/3 · 1 项待处理`。
7. 校准字体大小、粗细、muted 文案颜色、内外卡片 padding、圆角和阴影，使其接近截图。
8. 若需要展示 OpenSpec 提到的 `已完成` pill，在 playground 样张中保持 pill 为小号辅助状态，不得挤占或放大主行；真实 renderer 也要保持状态 badge 克制。

验证：

- Todo 分组截图肉眼对比用户截图：外层大卡片、两张内层卡片、样张图标/pill/chevron/摘要/统计行均存在且位置正确。
- 再对照 `work.pen` 的 `todoReadCard` / `todoWriteCard`：内层卡片为 16px 圆角、18px padding，工具行文本为 14px，图标和 chevron 为 14px 左右。

停手条件：

- OpenSpec task 5.4 的所有结构点都能在页面中直接看到。

### Slice 4: 恢复 Web Fetch 工具总览 UI

目标：

- `WebFetchToolDemo.vue` 按用户截图恢复 Web Fetch 分组与三态样张。

涉及文件 / 子系统：

- `app/ui-playground/src/demos/scenes/WebFetchToolDemo.vue`
- `app/ui-playground/src/demos/mock-data.ts`
- 样张组件

实施步骤：

1. 使用 `ToolGallerySection` 渲染外层 `Web Fetch` 分组。
2. 添加分组说明：`抓取类工具，适合检查 URL 摘要、内容预览和参数面板。`
3. 在内容区渲染 `Web Fetch 工具状态` 内层区域，标题和说明与 UI 稿一致。
4. 显示普通态弱化文本：`读取 vite.dev/config/server-options`。
5. 显示 hover 样张态：前景色 `读取 vite.dev/config/server-options` + `chevron-right`。
6. 显示展开态头部：弱化 `读取 vite.dev/config/server-options` + `chevron-down`。
7. 展开详情行依次使用 `globe`、`circle-check`、`file-text` 图标，文本为 `vite.dev/config/server-options`、`抓取完成`、`Markdown 内容预览`。
8. 校准分组顶部留白、分割线、内层区域 padding、行距和图标对齐，使其接近截图。
9. Web Fetch 状态行必须按 `work.pen` 保持 14px 文本和 14px chevron/detail icons；不要使用 20px 样张文字或 20px 图标。

验证：

- Web Fetch 分组截图肉眼对比用户截图：普通 / hover / 展开三态同时可见，详情行图标和文本层级正确。
- 再对照 `work.pen` 的 `Fetch Result Card`：内层卡片为 16px 圆角、18px padding、14px 状态行、5px 展开详情竖向间距。

停手条件：

- OpenSpec task 5.5 的所有结构点都能在页面中直接看到。

### Slice 5: 补齐其它工具总览样张

目标：

- 在 Todo 和 Web Fetch 恢复后，按同一组件模式整理 Bash、Web Search、Automation Create、Core Renderer、Default Fallback。

涉及文件 / 子系统：

- `app/ui-playground/src/demos/scenes/BashToolDemo.vue`
- `app/ui-playground/src/demos/scenes/WebSearchToolDemo.vue`
- `app/ui-playground/src/demos/scenes/AutomationToolDemo.vue`
- `app/ui-playground/src/demos/scenes/CoreToolDemo.vue`
- `app/ui-playground/src/demos/scenes/DefaultToolDemo.vue`
- `app/ui-playground/src/demos/mock-data.ts`

实施步骤：

1. 对每个工具 demo 使用外层分组卡片和必要内层样张卡片。
2. Bash 覆盖成功 / 失败样张：命令摘要、完成 / 失败状态、控制台输出入口。
3. Web Search 覆盖查询摘要、站点 pill、结果数量和结果摘要入口。
4. Automation Create 覆盖标题、计划时间、自动化已创建状态和次级打开动作。
5. Core Renderer 覆盖 core 分类与 JSON 参数详情。
6. Default Fallback 覆盖未知工具、默认降级渲染和 JSON 详情。
7. 至少保留一个 running 或 pending 状态样张。
8. Bash、Automation、Core、Default 的普通 / hover / 展开样张同样使用 `work.pen` 的 14px 工具行和 18px 内层标题，不按真实 renderer 当前视觉任意放大。

验证：

- 工具总览能一次性看到 OpenSpec 要求的所有工具类型和主要状态。
- 所有分组都符合 `DESIGN.md` 的克制工具界面，不出现营销化布局。
- Bash / Automation / Core / Default 的样张与 `work.pen` 对应节点逐项比对文本、图标、chevron 和详情行。

停手条件：

- OpenSpec task 5.1、5.2、5.3 的 playground 范围均已满足。

### Slice 6: 回收真实 renderer 复用点

目标：

- 在 playground 样张恢复后，检查并修正真实 `@willow/ui` renderer，使聊天内联工具卡片与样张同视觉语言。
- 在真实 renderer 接入 loading 之前，确认卡片基座仍保持原有交互语义。

涉及文件 / 子系统：

- `packages/ui/src/components/ToolCallCard.vue`
- `packages/ui/src/components/ToolCallDetailRow.vue`
- `packages/ui/src/components/ToolMessage.vue`
- `packages/ui/src/renderers/*ToolRenderer.vue`
- `packages/ui/src/index.ts`
- `app/work/src/renderer/src/App.vue`

实施步骤：

1. 审查上一轮新增或修改的 `ToolCallCard` / `ToolCallDetailRow`，确认是否符合 UI 稿里的圆角、字号、pill、chevron 和详情行风格。
2. 若组件可用，保留并微调；若它导致样张或真实 renderer 偏离 UI 稿，则收窄 API 或局部替换。
3. 确认 Todo / Web Fetch 真实 renderer 的默认态、hover 态、展开态内容与 OpenSpec 对应，但不要求在真实卡片里同时展示三态。
4. 确认 Bash、Web Search、Automation Create、Core、Default 的状态摘要和展开详情符合 `spec.md`。
5. 确认 `ToolMessage.vue` 审批提示使用 `@willow/shadcn` Button，且层级在工具卡片上方。
6. 确认 `app/work/src/renderer/src/App.vue` 注册 `automation_create` renderer，同时保留 `todoread` / `todowrite`。

验证：

- 真实 renderer 不破坏聊天消息流内联展示。
- playground 样张和真实 renderer 共享同一视觉语言，但职责不混淆。

停手条件：

- OpenSpec task 2、3、4 的真实 renderer 范围完成，且没有牺牲 Slice 3/4 的 UI 稿还原。

### Slice 7: 增加 ToolCallCard loading 扫光

目标：

- 在共享工具卡片基座中实现 `loading?: boolean`，由调用方显式控制扫光启动。
- 保证扫光是轻量状态反馈，不遮挡内容、不影响展开和审批交互。

涉及文件 / 子系统：

- `packages/ui/src/components/ToolCallCard.vue`
- `packages/ui/src/style.css`，仅在需要复用现有 shimmer keyframes 时触达
- `packages/ui/src/renderers/BashToolRenderer.vue`
- `packages/ui/src/renderers/WebSearchToolRenderer.vue`
- `packages/ui/src/renderers/WebFetchToolRenderer.vue`
- `packages/ui/src/renderers/TodoToolRenderer.vue`
- `packages/ui/src/renderers/AutomationCreateToolRenderer.vue`
- `packages/ui/src/renderers/CoreToolRenderer.vue`
- `packages/ui/src/renderers/DefaultToolRenderer.vue`
- `app/ui-playground/src/demos/scenes/*`

实施步骤：

1. 在 `ToolCallCard.vue` props 中新增 `loading?: boolean`，默认 `false`。
2. 计算有效 loading，例如 `props.loading && !props.error && !props.disabled`，避免失败态或禁用态继续扫光。
3. 在卡片根节点追加状态 class 或 data attribute，例如 `willow-tool-card-loading` / `data-loading`。
4. 用根容器伪元素或内部装饰层实现扫光：`position: relative`、`overflow: hidden`、`pointer-events: none`、低透明度斜向渐变、受控动画时长。
5. 确保内容层级高于扫光层，标题、图标、状态、chevron、summary、details 都保持可读和可点击。
6. 添加 `@media (prefers-reduced-motion: reduce)` 规则：关闭动画或保持静态淡层；状态仍由 `stateLabel` 表达。
7. 在 Bash、Web Search、Web Fetch、Todo、Automation Create、Core、Default renderer 中按 OpenSpec 传入 `:loading="state === 'running' || state === 'pending'"`，并确认 error / completed 不传入或被有效 loading 计算屏蔽。
8. 在 playground 工具总览补充至少一个 running 或 pending 样张，使用真实 `ToolCallCard` 的 `loading` prop 展示扫光；不要用平行 CSS 假造。
9. 检查扫光不会导致当前无边框 / 透明背景样式下完全不可见；如不可见，使用现有 token 增加轻微表面高光，但不引入新主题色。

验证：

- 普通 `ToolCallCard` 未传 `loading` 时视觉不变。
- `loading=true` 时卡片显示扫光，标题、图标、状态文案、chevron 和详情仍清楚可见。
- error / disabled 卡片不显示扫光。
- 展开和折叠仍能用鼠标和键盘触发。
- reduced-motion 环境下不依赖动画表达状态。
- playground 中至少一个 running 或 pending 样张能看到真实 `loading` prop 效果。

停手条件：

- OpenSpec task 2.4、2.5、2.6、3.7、5.6 的实现入口都明确，且没有改动工具执行协议。

### Slice 8: 视觉对照、命令验证与任务更新

目标：

- 完成构建、lint、视觉验收，并只标记真正完成的 OpenSpec tasks。

涉及文件 / 子系统：

- `docs/ai-workflows/openspec/changes/update-tool-call-ui-from-work-pen/tasks.md`
- `app/ui-playground`
- `packages/ui`
- `app/work`

实施步骤：

1. 运行 `pnpm lint`。
2. 运行 `pnpm --filter ./app/ui-playground exec vite build`。
3. 如果需要覆盖 `packages/ui`，运行可用的相关 build；若根 `pnpm build` 代价可接受，则运行根 build。
4. 启动 `pnpm dev:ui`；如果默认端口被占用，使用 `pnpm --filter ./app/ui-playground exec vite --host 127.0.0.1 --port 4174`。
5. 用浏览器检查工具总览，重点截图对照 Todo 与 Web Fetch；同时回看 `ui/work.pen` 节点截图，确认工具行字号没有被放大。
6. 在 playground 和真实聊天 renderer 中检查 loading 扫光：running / pending 有扫光，完成 / 失败 / 禁用无扫光。
7. 如条件允许，启动主应用检查真实聊天工具 renderer、审批提示、异常状态。
8. 只有在视觉对照和命令验证完成后，更新 `tasks.md` 对应 checkbox。

验证：

- `pnpm lint` 通过，或仅剩明确无关的既有问题并记录。
- playground build 通过。
- Todo / Web Fetch 与用户截图完成逐项肉眼对比。
- OpenSpec task 5.4、5.5、5.6、5.7 不在视觉对照前提前勾选。
- OpenSpec task 6.5 只在确认扫光不遮挡标题、状态、chevron、展开详情或审批提示后勾选。

停手条件：

- 计划范围内实现与 OpenSpec 对齐，可以进入 `workflow-close`。

## Recommended Order

1. Slice 1: 稳住现状并读取视觉基准
2. Slice 2: 建立 playground 样张基础组件
3. Slice 3: 恢复 Todo 工具总览 UI
4. Slice 4: 恢复 Web Fetch 工具总览 UI
5. Slice 5: 补齐其它工具总览样张
6. Slice 6: 回收真实 renderer 复用点
7. Slice 7: 增加 ToolCallCard loading 扫光
8. Slice 8: 视觉对照、命令验证与任务更新

## Definition Of Done

- `app/ui-playground` 工具总览优先匹配 `ui/work.pen` 与用户截图，而不是只显示真实 renderer。
- Tool 样张的字体、图标、圆角、padding、阴影按 `Work.pen Tool Style Contract` 校准，尤其避免比 `work.pen` 放大一档。
- Todo 与 Web Fetch 两个被指出偏差的分组已完成截图级视觉校对。
- `ToolCallCard` 支持 `loading` prop，running / pending 工具可显示扫光，完成 / 失败 / 禁用状态不显示扫光。
- 真实 `@willow/ui` renderer 与样张使用一致的视觉语言，并继续适合聊天消息流。
- OpenSpec `tasks.md` 只勾选已实现且已验证的条目。
- 验证结果和任何未完成项都在实现收尾时明确记录。
