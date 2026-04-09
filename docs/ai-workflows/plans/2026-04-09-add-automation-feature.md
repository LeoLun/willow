# 2026-04-09 add-automation-feature

## Goal

基于 `docs/ai-workflows/openspec/changes/add-automation-feature/` 的已批准范围，按仓库现有 Electron + Vue 架构落地自动化能力，包括数据库模型、主进程调度与补偿执行、AI tools、IPC 合约和 `/auto` 页面。

## OpenSpec Inputs

- `docs/ai-workflows/openspec/changes/add-automation-feature/proposal.md`
- `docs/ai-workflows/openspec/changes/add-automation-feature/design.md`
- `docs/ai-workflows/openspec/changes/add-automation-feature/tasks.md`
- `docs/ai-workflows/openspec/changes/add-automation-feature/specs/automation/spec.md`

## Current Code Anchors

- 数据库 schema 与 migration 位于 `app/work/src/main/db/`
- 主进程服务与 DAO 位于 `app/work/src/main/service/`、`app/work/src/main/service/dao/`
- IPC controller 通过 `app/work/src/main/controllers/` + `app/work/src/main/app.module.ts` 注册
- preload 入口位于 `app/work/src/preload/preload.ts`
- shared 请求/响应类型与 IPC 常量位于 `app/work/src/shared/api.ts`、`app/work/src/shared/constants.ts`
- `/auto` 页面目前仅为占位页：`app/work/src/renderer/src/pages/auto/Auto.vue`
- Core tool 挂载点位于 `packages/core/src/tools/index.ts`，由 `packages/core/src/core-agent.ts` 注入 agent
- 应用初始化入口在 `app/work/src/main/controllers/init.controller.ts`

## Assumptions

- 自动化执行会话策略采用设计稿中的推荐值：每次触发创建新会话，而不是复用固定会话。
- 首期只交付 OpenSpec 已要求的列表、创建、删除、启停、最近运行信息；如果实现中加入编辑 UI，必须不超出既有规范。
- cron 校验、调度注册和漏跑时间点计算必须共用同一套 cron 语义来源。

## Dependencies

- `app/work` 需要引入 `node-cron`
- 如补偿执行需要稳定计算上一次/下一次计划点，可能还需要补充一个 cron 解析库；若仅靠 `node-cron` 无法安全完成，则先确认依赖方案再实现
- Drizzle schema、SQL migration、`meta/*_snapshot.json`、`_journal.json` 需要同步维护

## Blockers And Escalation Rules

- 当前没有硬 blocker
- 如果实现中发现以下任一问题，应先回到 `workflow-spec`，不要直接在代码里私自扩义：
- 自动化标题生成规则需要用户可配置
- 最近运行摘要需要超出 `automation_runs` 当前设计的新字段
- 除 `schedule` 外的 trigger 类型被实现需求隐式引入

## Execution Slices

### Slice 1: Data Model And Migration Baseline

目标：
- 建立自动化主体、触发器、执行记录三张表，并补齐补偿执行所需锚点字段。

涉及文件 / 子系统：
- `app/work/src/main/db/schema.ts`
- `app/work/src/main/db/migrations/*.sql`
- `app/work/src/main/db/migrations/meta/*.json`

实施步骤：
1. 在 `schema.ts` 中新增 `automations`、`automationTriggers`、`automationRuns` 表定义。
2. 为 `automations` 增加 `workspaceId`、`title`、`prompt`、`status`、`triggerType`、`lastScheduledAt`、`lastRunAt`、`lastCompletedAt`、时间戳字段。
3. 为 `automationTriggers` 增加 `automationId`、`type`、`cronExpression`、`timezone`、`isActive`、时间戳字段。
4. 为 `automationRuns` 增加 `automationId`、`scheduledFor`、`triggeredAt`、`runKind`、`status`、`sessionId`、`errorMessage`、时间戳字段。
5. 统一文本枚举值，至少覆盖 `enabled/disabled`、`schedule`、`scheduled/catch_up`、`running/completed/failed`。
6. 新增 migration，并同步更新 drizzle meta 快照与 journal。

验证：
- schema 与 migration 字段逐项对照，无缺失
- 数据库初始化流程能执行新增 migration

停手条件：
- 自动化三张表可以支撑 CRUD、调度恢复、补偿执行和列表摘要展示

### Slice 2: DAO, Scheduler, And Automation Service

目标：
- 在主进程内部形成自动化的单一业务入口，封装 CRUD、调度注册、启动恢复、补偿判断与执行互斥。

涉及文件 / 子系统：
- `app/work/src/main/service/dao/automation.dao.service.ts`
- `app/work/src/main/service/dao/automation-trigger.dao.service.ts`
- `app/work/src/main/service/dao/automation-run.dao.service.ts`
- `app/work/src/main/service/automation.service.ts`
- `app/work/src/main/service/automation-scheduler.service.ts`
- `app/work/src/main/service/session.service.ts`
- `app/work/src/main/service/agent.service.ts`
- `app/work/src/main/controllers/init.controller.ts`
- `app/work/src/main/app.module.ts`

实施步骤：
1. 参考现有 `workspace/session/model` DAO 风格，为 automation 三张表补齐基础 DAO。
2. 新增 `AutomationScheduler`，只负责 `node-cron` 的 register / unregister / reschedule，不承载业务判断。
3. 新增 `AutomationService`，集中处理创建、列表、详情、更新、删除、启停。
4. 在 `AutomationService` 中统一 cron 合法性校验与 schedule-only trigger 校验。
5. 在创建、更新、删除、状态切换后同步完成调度注册或注销。
6. 在启动恢复阶段加载所有启用中自动化并重新注册调度。
7. 根据 `lastScheduledAt` 与当前时间做漏跑判断，只补最后一次。
8. 为同一自动化增加运行互斥；发现已有 `running` 任务时跳过新一轮并记录日志。
9. 执行时创建新 session，并通过现有 `SessionService` / `AgentService` 发送自动化 prompt。
10. 在运行前后维护 `automations` 与 `automationRuns` 的状态、时间和错误信息。

验证：
- 创建启用中的自动化后立即完成调度注册
- 更新 cron 或禁用状态后，旧任务被卸载，新任务按最新配置注册
- 删除自动化后调度被移除
- 人工制造 `lastScheduledAt` 落后场景时，只补最后一个计划点

停手条件：
- 主进程已经具备稳定的自动化运行底座，UI 尚未接入也可通过 service 层驱动完整生命周期

### Slice 3: Shared Contracts, IPC, And Preload Exposure

目标：
- 为 renderer、主进程、AI tools 之间建立统一的数据契约，避免 schedule mode 和持久化 cron 语义分叉。

涉及文件 / 子系统：
- `app/work/src/shared/api.ts`
- `app/work/src/shared/constants.ts`
- `app/work/src/shared/hook/*.ts`
- `app/work/src/shared/hook/index.ts`
- `app/work/src/preload/preload.ts`
- `app/work/src/main/controllers/automation/*.ts`
- `app/work/src/main/app.module.ts`

实施步骤：
1. 在 `shared/api.ts` 中新增 automation 实体、trigger 实体、run summary、列表项 DTO、CRUD request/response。
2. 在请求契约中明确前端 schedule mode 与最终 `cronExpression` 的并存关系，保证主进程始终以标准 cron 为准。
3. 在 `shared/constants.ts` 增加自动化相关 IPC channels。
4. 新增 `IAutomationApi` 并接入 `IRenderHook`。
5. 新增自动化 controllers，至少覆盖 `list/get/create/update/delete`，如启停单独暴露则同步定义。
6. 在 `preload.ts` 中将自动化 API 暴露给 `window.electronAPI`。
7. 在 `app.module.ts` 中注册新增 controller 和 service/dao provider。

验证：
- TypeScript 类型联通，renderer 可直接调用新增 `electronAPI` 方法
- 非法 cron、缺失 workspace、未知 automation id 都能返回明确错误

停手条件：
- 自动化能力已具备稳定 IPC 合约，renderer 不需要直接触碰主进程实现细节

### Slice 4: AI Tools Integration

目标：
- 将自动化 CRUD 暴露给 agent，且输入校验与主进程服务复用同一来源。

涉及文件 / 子系统：
- `packages/core/src/tools/index.ts`
- 如需新增：`packages/core/src/tools/automation-*.ts`
- `packages/core/src/core-agent.ts`
- `app/work/src/main/service/automation.service.ts`
- 如需桥接：`app/work/src/main/service/automation-tool.service.ts`

实施步骤：
1. 基于 `packages/core/src/tools/create-tool.ts` 现有模式新增 automation tools。
2. 实现 `automation_list`、`automation_get`、`automation_create`、`automation_update`、`automation_delete`。
3. 让 tool handler 复用 `AutomationService` 的校验和摘要生成逻辑，不在 tool 层重复实现 cron 规则。
4. 在返回结果中包含 automation 基础信息、trigger 信息、cron 摘要、状态和最近运行摘要，便于对话确认。
5. 将新工具接入 `createAllTools()`，确认 `CoreAgent` 会自动把工具名写入 system prompt。

验证：
- agent 初始化后的工具列表包含 automation 工具
- 工具成功路径与错误路径均能输出结构化结果

停手条件：
- AI 可完整管理自动化，且工具返回适合直接用于对话确认

### Slice 5: Renderer State And `/auto` Page Skeleton

目标：
- 将当前占位页替换为真正的自动化管理页，先完成数据加载、空状态和列表展示。

涉及文件 / 子系统：
- `app/work/src/renderer/src/pages/auto/Auto.vue`
- `app/work/src/renderer/src/stores/automation.ts`
- 如需新增：`app/work/src/renderer/src/components/automation/*.vue`
- `app/work/src/renderer/src/stores/workspace.ts`

实施步骤：
1. 新增 setup-style Pinia automation store，封装列表加载、创建、删除、启停、刷新。
2. 页面进入时加载 automation 列表，并在需要时复用 workspace store 获取 workspace 名称。
3. 重写 `/auto` 页面头部，加入标题说明和右上角“添加自动化”按钮。
4. 空列表时展示引导文案和主按钮。
5. 非空列表时展示每条自动化的标题、工作空间、cron 摘要、prompt 摘要、启用状态、最近运行信息。
6. 为 loading / empty / populated 三种状态提供稳定 UI。

验证：
- 初次进入页面可以拿到列表数据
- 空状态与非空状态切换正确
- 删除或启停后列表能及时刷新

停手条件：
- `/auto` 不再是占位页，且列表信息已满足 OpenSpec 成功标准

### Slice 6: Create Dialog, Schedule Modes, And Preview Card

目标：
- 完成自动化创建主流程，支持四种计划输入方式和实时预览。

涉及文件 / 子系统：
- `app/work/src/renderer/src/layout/dialog/automation-form/*.vue`
- `app/work/src/renderer/src/layout/dialog/index.ts`
- `app/work/src/renderer/src/layout/dialog/use-dialog.ts`
- `app/work/src/renderer/src/pages/auto/Auto.vue`
- `app/work/src/renderer/src/components/ui/*`

实施步骤：
1. 参考现有 dialog 组织方式新增 automation form dialog。
2. 用现有 shadcn-vue 组件组合实现 workspace 选择、schedule mode 切换、时间输入、cron 输入、prompt 文本域。
3. 在前端实现四种 schedule mode：`daily_at`、`hourly`、`weekly_at`、`custom`。
4. 每种 mode 都即时生成标准 cron 表达式与用户可读摘要。
5. `custom` 模式下提供 cron 校验与可理解错误信息。
6. 预览卡片实时显示 workspace、trigger 摘要、最终 cron、prompt 摘要、自动生成标题。
7. 提交成功后关闭弹窗并刷新列表。

验证：
- 点击“添加自动化”能打开弹窗
- 四种计划方式都能得到正确 cron 与摘要
- 非法输入无法提交
- 创建成功后列表即时出现新自动化

停手条件：
- 用户可以完整创建第一条自动化，且预览与最终持久化内容一致

### Slice 7: End-To-End Verification And Closeout Input

目标：
- 在进入 `workflow-implement` 收尾前，拿到完整的手工验证与基础回归结果。

执行步骤：
1. 运行 `pnpm lint`
2. 运行受影响构建命令，至少覆盖 workspace 包与 `app/work`
3. 使用 `pnpm dev` 手工验证以下场景：
4. `/auto` 空状态
5. 创建 daily/hourly/weekly/custom 自动化
6. 删除与启停
7. 正常 cron 触发
8. 退出应用后的单次漏跑补偿
9. 退出应用后的多次漏跑仅补最后一次
10. AI tools 的 list/get/create/update/delete
11. 记录未覆盖风险，作为 `workflow-close` 的输入

验证：
- lint 通过
- 相关构建通过
- 手工场景与 OpenSpec 成功标准一致

停手条件：
- 已具备进入 `workflow-close` 所需的验证证据，或已经定位到需要继续修复的明确缺陷

## Recommended Order

1. Slice 1
2. Slice 2
3. Slice 3
4. Slice 4
5. Slice 5
6. Slice 6
7. Slice 7

## Notes For `workflow-implement`

- 先做主进程底座，再接 IPC，再做 UI；不要从 `/auto` 页面开始倒推后端。
- 自动化启动恢复应接在 `InitController.init()` 成功完成数据库初始化之后，而不是散落在 renderer 首次访问时触发。
- 若 `node-cron` 本身不足以安全支持补偿时间点计算，需要先补一个专用 cron 解析依赖，再继续实现；不要手写 `setTimeout` / `setInterval` 逻辑替代。
- 如果“每次触发创建新会话”的假设需要改变，应先回到 `workflow-spec` 更新约束。
