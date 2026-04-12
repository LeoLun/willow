# 2026-04-12 add-ui-playground-dev-page

## Goal

基于 `add-ui-playground-dev-page` OpenSpec，为 `@willow/ui` 增加一个独立的 localhost playground，使开发者可以通过单独的 dev 命令启动本地 Web 服务，并直接在浏览器中调试消息组件、工具渲染器和核心样式场景，而无需启动 Electron 主应用。

## OpenSpec Inputs

- `docs/ai-workflows/openspec/changes/add-ui-playground-dev-page/proposal.md`
- `docs/ai-workflows/openspec/changes/add-ui-playground-dev-page/design.md`
- `docs/ai-workflows/openspec/changes/add-ui-playground-dev-page/tasks.md`
- `docs/ai-workflows/openspec/changes/add-ui-playground-dev-page/specs/ui-playground/spec.md`
- `DESIGN.md`

## Current Code Anchors

- `package.json`
- `pnpm-workspace.yaml`
- `packages/ui/package.json`
- `packages/ui/src/index.ts`
- `packages/ui/src/style.css`
- `packages/ui/src/components/`
- `packages/ui/src/renderers/`
- `packages/ui/src/utils/`
- `app/work/vite.renderer.config.ts`

## Assumptions

- 本次 playground 默认服务于本地开发与手工样式验收，不要求生产发布
- 默认将 playground 落为独立 workspace app，而不是继续塞进 `packages/ui` 包本体
- 默认优先复用 `@willow/ui` 的公开导出与样式入口；只有在 demo 组织确实需要时，才补充最小开发辅助文件
- 当前仓库没有正式测试框架，验证以 `pnpm lint`、dev server 启动、浏览器手工检查为主

## Dependencies

- playground 的样式与页面壳必须遵循根 `DESIGN.md`，不能引入第二套视觉 token
- playground 需要最小化复用现有 Vite 能力，尤其是 Vue、Tailwind v4 和 `@willow/ui` 所需的依赖优化项
- 根脚本新增必须不影响现有 `pnpm dev` 指向 `app/work` 的行为
- `@willow/ui` 当前含有 peer dependency 和 renderer registry 能力，playground 需要通过 mock 数据和最小注册方式驱动，而不是耦合 Electron 或业务 store

## Blockers And Escalation Rules

- 当前没有硬 blocker
- 如果实现时发现 `@willow/ui` 的关键组件无法通过公开导出在纯 Web 环境中运行，需要先判断是补开发辅助导出还是回到 `workflow-spec` 扩展范围
- 如果实现时必须引入 Storybook、Histoire 或大规模文档站基础设施，先回到 `workflow-spec`，不在本计划内直接升级方案
- 如果 playground 需要依赖业务 store、IPC 或 Electron API 才能渲染核心 demo，先停手并回到 `workflow-spec` 重新界定边界

## Execution Slices

### Slice 1: 独立 playground 脚手架与 dev 入口

目标：
- 建立一个可由 `pnpm` 单独启动的 localhost Web playground，并与 Electron 主应用开发链路解耦

涉及文件 / 子系统：
- `package.json`
- 新的 playground workspace 目录
- playground `package.json`
- playground `vite.config.ts`
- playground `index.html`
- playground 入口文件与基础应用壳

实施步骤：
1. 新增一个独立 workspace app，推荐放在 `app/ui-playground/`，保持其职责是开发调试入口而不是组件库发布物。
2. 为 playground 配置最小 `package.json` 与 `dev` 脚本，使用 Vite + Vue 启动 localhost 服务。
3. 在仓库根 `package.json` 增加清晰的入口脚本，例如 `dev:ui` 或等价命名，确保不覆盖现有 `dev`。
4. 在 playground 的 Vite 配置中显式设置 `host = 127.0.0.1`，并提供稳定端口与清晰的控制台访问地址输出。
5. 让 playground 直接消费 workspace 内的 `@willow/ui` 源码或包导出，确保热更新能覆盖 `packages/ui/src` 改动。

验证：
- `pnpm` 可以发现并启动 playground workspace。
- 根脚本可以单独启动 localhost 服务。
- 启动 playground 时不会拉起 Electron。

停手条件：
- 本地已经有稳定、可重复进入的浏览器调试入口，且与现有 `pnpm dev` 语义不冲突。

### Slice 2: Web 运行时对齐与样式基线复用

目标：
- 让 playground 在纯 Web 环境中稳定渲染 `@willow/ui`，并保持与项目设计基线一致

涉及文件 / 子系统：
- playground `vite.config.ts`
- playground 全局样式文件
- `packages/ui/src/style.css`
- 可能需要的开发期 alias / optimizeDeps 配置
- `DESIGN.md`

实施步骤：
1. 复用 `@willow/ui` 的样式入口，避免复制平行 CSS。
2. 对齐 playground 的 Vite 能力与 `@willow/ui` 当前运行所需依赖，例如 Vue 插件、Tailwind、highlight / marked / katex 等依赖优化项。
3. 为 playground 补一个最小的页面壳样式，只负责容器、导航、卡片和内容节奏，不创建新的视觉 token。
4. 校验页面壳符合 `DESIGN.md` 的工具型、可扫描、低装饰要求。
5. 若 `@willow/ui` 对运行环境有隐式依赖，优先在 playground 侧补最小适配，而不是把 `app/work` 的整套配置复制过来。

验证：
- playground 首屏能正确加载样式，没有明显丢失 Markdown、高亮或基础排版。
- 页面壳不需要 Electron、IPC、业务 store 即可独立渲染。
- 视觉层级符合 `DESIGN.md`，没有偏营销化展示页风格。

停手条件：
- playground 已经可以作为稳定的 Web 容器承载后续 demo，不需要再向主应用借运行时上下文。

### Slice 3: demo 数据模型与场景注册表

目标：
- 建立可维护的 demo 组织方式，让后续组件样例扩展不依赖临时硬编码

涉及文件 / 子系统：
- playground demo 目录
- demo registry / 场景配置文件
- mock message / mock tool data
- playground 导航与详情展示组件

实施步骤：
1. 为 demo 建立集中式注册表，按消息组件、工具渲染器、基础内容块等维度分组。
2. 把代表性 mock 数据抽成独立配置，避免把大段样例直接散落在页面组件里。
3. 为每个 demo 提供标题、短说明、渲染组件和必要的状态切换元信息。
4. 让导航层只负责场景切换，渲染层只负责展示当前 demo，保持职责清晰。
5. 保留后续扩展点，例如新增 demo 分组或变体时无需改动整页布局。

验证：
- demo 可以按分组切换，而不是单页堆叠所有样例。
- mock 数据与页面骨架分离，后续新增 demo 不需要重写导航结构。
- 代码组织能够清楚区分“场景定义”和“展示容器”。

停手条件：
- playground 的 demo 组织方式已经可持续维护，不会在第二批样例接入时迅速失控。

### Slice 4: 核心组件与边界状态样例

目标：
- 提供满足 OpenSpec 的第一批代表性 UI 场景，覆盖样式调试最常见的问题面

涉及文件 / 子系统：
- `packages/ui/src/components/`
- `packages/ui/src/renderers/`
- playground demo 实现文件

实施步骤：
1. 先接入一组核心消息样例，至少覆盖用户消息、助手消息、流式消息容器。
2. 接入内容块样例，至少覆盖 Markdown、代码块、控制台输出、折叠内容等真实视觉形态。
3. 接入工具渲染相关样例，优先选择当前 `packages/ui/src/renderers/` 已存在的核心 renderer。
4. 为第一批 demo 提供边界状态，至少覆盖长内容、空态、加载态、错误态中的代表场景。
5. 保持每个 demo 的视觉目的单一，避免一个样例同时承载过多变量。

验证：
- 浏览器中可见至少一组核心消息组件样例。
- 浏览器中可见至少一组工具渲染或调试块样例。
- 可以肉眼检查长内容、折叠内容、空态或错误态的布局稳定性。

停手条件：
- playground 已能承担“样式调试入口”的核心职责，而不仅是一个空壳页面。

### Slice 5: 浏览器调试工作流与仓库集成收尾

目标：
- 让团队可以稳定使用新的 dev 工作流，并留有足够的验证证据进入实现收尾

涉及文件 / 子系统：
- 根 `package.json`
- playground workspace
- 可能需要的 README / 注释型说明
- `docs/ai-workflows/plans/2026-04-12-add-ui-playground-dev-page.md`

实施步骤：
1. 确认 playground 启动命令、默认 localhost 地址和访问方式对开发者足够直观。
2. 运行 `pnpm lint`，确保新增文件进入现有代码质量流程。
3. 手工启动 playground，记录浏览器访问与热更新是否正常。
4. 交叉验证关闭 playground 后，原有 `pnpm dev` 仍然只服务 `app/work`。
5. 记录任何需要回到 OpenSpec 的发现；如果没有，则为 `workflow-implement` 和后续 `workflow-close` 准备验证结果。

验证：
- `pnpm dev:ui` 或实现阶段选定的等价命令能稳定启动。
- 浏览器可通过明确的 localhost 地址访问 playground。
- `pnpm dev` 仍保持 Electron 工作流不变。
- `pnpm lint` 通过，或至少只暴露与本次变更直接相关的问题。

停手条件：
- 新的浏览器调试工作流已经稳定、可复现、可交接。

## Recommended Order

1. Slice 1
2. Slice 2
3. Slice 3
4. Slice 4
5. Slice 5

## Verification

- 启动独立 localhost playground，确认不依赖 Electron
- 在浏览器中访问默认本地地址，确认首屏和热更新正常
- 检查 demo 是否覆盖消息组件、工具渲染器和至少一类边界状态
- 运行 `pnpm lint`
- 回归确认根 `pnpm dev` 仍只启动 `app/work`

## Notes For `workflow-implement`

- 实现时优先选“独立 workspace app + 根脚本入口”的最小方案，不要把测试页塞回 `app/work` 路由
- 如果需要新增 playground 专用辅助文件，优先放在 playground workspace 内，避免污染 `packages/ui` 对外 API
- 组件样例优先覆盖当前已经导出的组件与现有 renderer，不要在实现阶段顺手扩展新的组件能力
- 页面壳设计以 `DESIGN.md` 为准，重点是清晰、克制、可扫描，不需要做宣传式展示页

## Notes For `workflow-close`

- 收尾时重点保留三类证据：localhost 启动成功、浏览器访问成功、核心 demo 渲染成功
- 若存在未覆盖的次级组件，可作为后续扩展项记录，不阻塞本次“建立可用调试入口”的主目标
