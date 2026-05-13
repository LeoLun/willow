# 2026-04-12 create-willow-shadcn

## Goal

基于 `docs/ai-workflows/openspec/changes/create-willow-shadcn/` 的批准范围，创建 `@willow/shadcn` 作为全仓共享的 shadcn 基础组件包，并用渐进迁移方式把 `app/work` 中的基础组件来源收口到该包，同时保持 `@willow/ui` 继续承载上层消息渲染与产品语义组件。

## OpenSpec Inputs

- `docs/ai-workflows/openspec/changes/create-willow-shadcn/proposal.md`
- `docs/ai-workflows/openspec/changes/create-willow-shadcn/design.md`
- `docs/ai-workflows/openspec/changes/create-willow-shadcn/tasks.md`
- `docs/ai-workflows/openspec/changes/create-willow-shadcn/specs/shadcn-package/spec.md`

## Current Code Anchors

- `packages/ui/package.json`
- `packages/ui/src/index.ts`
- `app/work/package.json`
- `components.json`
- `app/work/vite.renderer.config.ts`
- `app/ui-playground/vite.config.ts`
- `app/work/src/renderer/index.css`
- `app/work/src/renderer/src/lib/utils.ts`
- `app/work/src/renderer/src/components/ui/`

## Assumptions

- `@willow/shadcn` 会作为新 workspace 包新增在 `packages/shadcn/`，而不是直接重命名 `packages/ui`
- `@willow/shadcn` 作为源码直连 workspace 包使用，不单独增加构建产物或预编译发布要求
- 首轮实施只迁移一批明显属于基础 primitives 的组件，不要求一次性迁完整个 `components/ui/`
- `app/work` 短期内允许保留本地 re-export 或兼容层，避免页面 import 一次性大范围改写
- 视觉契约继续以仓库根 `DESIGN.md` 和 `components.json` 的 `new-york` + `neutral` 基线为准

## Dependencies

- `@willow/shadcn` 至少需要承接当前基础组件所依赖的 `reka-ui`、`class-variance-authority`、`clsx`、`tailwind-merge`、`lucide-vue-next`
- `app/work/src/renderer/index.css` 目前通过 `@source "../../../../packages/ui/src";` 扫描 `@willow/ui`，实施时需要补充或切换到 `packages/shadcn/src`
- `app/work` 与 `app/ui-playground` 的 Vite alias 目前只指向 `@willow/ui` 源码目录；由于 `@willow/shadcn` 直接按源码消费，新增包后需要补充 `@willow/shadcn` 到源码目录的解析
- 基础组件当前会引用 `@/lib/utils` 等 app 内别名，迁移时需要把这些依赖同步搬到共享包可访问位置

## Blockers And Escalation Rules

- 当前没有硬 blocker
- 如果实施时发现大量组件深度耦合 `app/work` 页面语义，超出“基础组件”边界，先回到 `workflow-spec` 缩小迁移范围或补充规则
- 如果需要重写视觉 token、Tailwind 主题契约或 `DESIGN.md`，先回到 `workflow-spec`
- 如果需要把 `@willow/ui` 的现有上层组件一起搬迁或重命名，也先回到 `workflow-spec`

## Execution Slices

### Slice 1: 建立 `@willow/shadcn` 包骨架

目标：
- 创建一个可被 workspace 应用直接按源码消费的新包，并固定目录结构、入口和依赖边界

涉及文件 / 子系统：
- `packages/shadcn/package.json`
- `packages/shadcn/src/index.ts`
- `packages/shadcn/src/style.css`
- `packages/shadcn/src/components/ui/`
- `pnpm-workspace.yaml`

实施步骤：
1. 新建 `packages/shadcn/` 包目录与 `package.json`
2. 参考 `packages/ui` 的导出方式，建立 `src/index.ts` 和样式入口
3. 在包内建立 `src/components/ui/` 与 `src/lib/` 基础结构，不增加独立 build 脚本
4. 把基础组件运行所需的公共工具位预留到包内，而不是继续依赖 `app/work` 私有路径

验证：
- workspace 能识别 `@willow/shadcn`
- 包入口路径与导出结构可被 Vite 直接从源码解析
- 新包职责只覆盖基础组件，不包含上层消息渲染组件

停手条件：
- 新包已具备承接首批组件迁移的最小骨架，不需要继续在空包状态下做额外抽象

### Slice 2: 抽离共享基础依赖与样式入口

目标：
- 为首批迁移组件准备可独立运行的公共依赖、工具函数和样式扫描入口

涉及文件 / 子系统：
- `packages/shadcn/src/lib/utils.ts`
- `packages/shadcn/src/style.css`
- `app/work/src/renderer/index.css`
- `components.json`

实施步骤：
1. 将 `cn` 等通用工具从 `app/work/src/renderer/src/lib/utils.ts` 提炼到 `packages/shadcn/src/lib/`
2. 在 `packages/shadcn/src/style.css` 中放置包级样式入口；如无需新增样式，也至少建立稳定入口供源码消费方引入
3. 调整 `app/work/src/renderer/index.css` 的 `@source`，确保 Tailwind 能扫描 `packages/shadcn/src`
4. 检查 `components.json` 中现有 alias 是否需要保留本地兼容层，避免和共享包导入策略冲突

验证：
- 首批迁移组件不再依赖 `@/lib/utils`
- `app/work` 构建时能够扫描到新包中的 class
- 不引入第二套 token 或脱离 `DESIGN.md` 的样式入口

停手条件：
- 基础组件可在共享包内独立解析依赖与 class，不再被 app 私有别名阻塞

### Slice 3: 迁移首批低耦合基础组件

目标：
- 先迁一批低风险、无业务语义、依赖简单的基础组件，验证包边界与导出策略

首批推荐组件：
- `button`
- `card`
- `input`
- `textarea`
- `label`
- `badge`
- `separator`
- `skeleton`
- `collapsible`

暂缓到后续批次的组件：
- `sidebar`
- `input-group`
- `sonner`
- `sheet`
- `dialog`
- `dropdown-menu`
- `alert-dialog`
- `toggle-group`
- `scroll-area`

原因：
- 首批组件依赖更简单，适合先验证包结构与共享工具
- 暂缓组件通常依赖更多子组件、动画、组合结构或页面接入面更广，放到骨架验证后再迁更安全

涉及文件 / 子系统：
- `packages/shadcn/src/components/ui/<component>/`
- `packages/shadcn/src/index.ts`
- `app/work/src/renderer/src/components/ui/<component>/`

实施步骤：
1. 逐个复制并整理首批组件源码到 `packages/shadcn/src/components/ui/`
2. 修正组件内部 import，使其依赖共享包内路径而非 `@/`
3. 为每个组件补齐目录级 `index.ts` 导出
4. 在 `packages/shadcn/src/index.ts` 补齐包根聚合导出
5. 保留 `app/work` 本地目录的兼容 re-export，或让本地组件入口改为转发到 `@willow/shadcn`

验证：
- 首批组件能从 `@willow/shadcn` 被单独导入
- `app/work` 现有页面在不大改业务逻辑的情况下仍能通过兼容层工作
- `@willow/ui` 未新增任何基础组件迁移内容

停手条件：
- 已有一批共享基础组件从 app 内部目录切出并可被消费，足以证明设计成立，再进入下一批迁移

### Slice 4: 接入消费方并验证渐进迁移路径

目标：
- 让现有应用能消费 `@willow/shadcn`，同时验证兼容迁移路径真实可用

涉及文件 / 子系统：
- `app/work/package.json`
- `app/ui-playground/package.json`
- `app/work/vite.renderer.config.ts`
- `app/ui-playground/vite.config.ts`
- `app/work/src/renderer/src/components/ui/` 中的兼容入口
- 至少 1 到 2 个真实页面或 demo 场景

实施步骤：
1. 为 `app/work` 和需要的消费方增加 `@willow/shadcn` workspace 依赖
2. 在相关 Vite 配置中补充 `@willow/shadcn` 指向 `packages/shadcn/src` 的源码 alias
3. 选择少量真实消费点验证直接导入与兼容 re-export 两条路径
4. 确认 `app/ui-playground` 在需要时也能直接引用 `@willow/shadcn` 展示基础组件

验证：
- `app/work` 至少存在一条真实导入链已接入 `@willow/shadcn`
- 兼容层与直接导入两条路径都能被开发环境从源码直接识别
- 不需要再通过跨应用内部路径访问基础组件

停手条件：
- 已证明新包可被应用消费，且迁移路线不要求一次性替换所有页面

### Slice 5: 第二批组件扩展与边界复核

目标：
- 在首批验证通过后，继续迁移结构更复杂的基础组件，并确保边界不漂移

候选组件：
- `dialog`
- `sheet`
- `dropdown-menu`
- `alert-dialog`
- `toggle`
- `toggle-group`
- `switch`
- `scroll-area`
- `progress`
- `avatar`

涉及文件 / 子系统：
- `packages/shadcn/src/components/ui/`
- `app/work/src/renderer/src/components/ui/`
- 对应消费页面与弹窗

实施步骤：
1. 按依赖树从低到高继续迁移组件
2. 每迁一组就检查是否引入了产品语义或 app 私有耦合
3. 若发现某类组件更适合作为 `app/work` 私有扩展，则留在本地目录，不强行塞进共享包

验证：
- 共享包中的新增组件仍然是基础 primitives 或轻量扩展
- 页面级组合逻辑没有被误搬到 `@willow/shadcn`

停手条件：
- 复杂基础组件的迁移已达到“共享价值明显大于维护成本”的程度；若继续迁移需要跨入业务语义，则停止并保留在 app 内

### Slice 6: 收尾验证与遗留项整理

目标：
- 为 `workflow-close` 准备清晰的验证结论、遗留项和后续迁移边界

涉及文件 / 子系统：
- `docs/ai-workflows/openspec/changes/create-willow-shadcn/tasks.md`
- `docs/ai-workflows/plans/2026-04-12-create-willow-shadcn.md`
- `packages/shadcn/`
- `packages/ui/`
- `app/work/src/renderer/src/components/ui/`

实施步骤：
1. 对照 OpenSpec tasks 更新实施完成度
2. 记录哪些组件已迁移、哪些因边界或耦合原因暂缓
3. 核对 `@willow/ui` 是否保持上层职责不变
4. 准备进入 `workflow-close` 的验证证据与残留风险说明

验证：
- OpenSpec 任务与实施结果一一对应
- `@willow/shadcn` 已成为共享基础组件的明确落点
- `@willow/ui` 与 `@willow/shadcn` 的职责边界仍清晰

停手条件：
- 已经可以清楚回答“哪些迁完了、哪些没迁、为什么”，并具备进入 `workflow-close` 的证据

## Recommended Order

1. Slice 1
2. Slice 2
3. Slice 3
4. Slice 4
5. Slice 5
6. Slice 6

## Verification

- `pnpm lint`
- `pnpm build`
- 如实施阶段包入口已接入真实消费方，至少验证一次 `pnpm --filter ./app/work run dev` 的启动链路，确认 `@willow/shadcn` 无需独立构建即可工作
- 检查 `app/work/src/renderer/index.css` 是否已正确扫描 `packages/shadcn/src`
- 检查 `rg -n "@/components/ui|@willow/shadcn|@willow/ui"` 结果，确认基础组件来源迁移方向符合预期

## Notes For `workflow-implement`

- 先做新包骨架和首批低耦合组件，不要一开始就迁 `sidebar`、`dialog` 全家桶
- `@willow/shadcn` 按源码直连消费，不额外引入包构建链路；优先复用现有 Vite alias 模式
- 优先保住兼容迁移路径，避免把实施变成全量 import 重写
- 每迁一组组件都要判断它是否仍属于基础 primitives；只要进入业务语义层，就应留在 app 本地
- 实施时如果发现 `packages/ui` 与 `packages/shadcn` 之间需要共享更底层工具，再单独抽离，但不要在未审阅情况下扩展成第三套大范围基础设施

## Notes For `workflow-close`

- 收尾时重点核对两件事：`@willow/shadcn` 是否真的成为新的共享来源，`@willow/ui` 是否保持上层职责
- 如果仍存在大量重复实现，要明确哪些是临时兼容层，哪些是遗留未迁移项
- 若验证只覆盖首批组件，要在收尾中明确第二批/第三批迁移仍是后续工作，不要把计划中的全部范围误报为已完成
