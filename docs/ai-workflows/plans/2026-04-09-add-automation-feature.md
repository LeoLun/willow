# 2026-04-09 add-automation-feature

## Goal

基于 `docs/ai-workflows/openspec/changes/add-automation-feature/` 的已批准范围，实现桌面端自动化能力，包括数据库模型、主进程调度、AI tools、IPC 合约和 `/auto` 页面。

## Inputs

- `docs/ai-workflows/openspec/changes/add-automation-feature/proposal.md`
- `docs/ai-workflows/openspec/changes/add-automation-feature/design.md`
- `docs/ai-workflows/openspec/changes/add-automation-feature/tasks.md`
- `docs/ai-workflows/openspec/changes/add-automation-feature/specs/automation/spec.md`

## Assumptions

- 自动化执行的会话策略按 OpenSpec 设计建议，默认采用“每次触发创建新会话”。
- 自动化页面首期只做创建、列表、删除和基础状态展示；如果实现中加入编辑入口，必须不超出 OpenSpec 已定义行为。
- cron 合法性校验与漏跑时间点计算将复用同一套调度语义，避免保存成功但调度失败。

## Dependencies

- 需要在 `app/work` 中引入并接入 `node-cron`。
- 数据库 migration 需要和 Drizzle schema、snapshot、journal 保持一致。
- 自动化 tools 的注册方式需要复用 `packages/core/src/tools` 现有入口。

## Blockers

- 当前无硬 blocker。
- 若实现时发现“自动化运行会话命名规则”或“列表展示所需的最近运行摘要字段”不足以支撑产品行为，应先回到 `workflow-spec` 更新 OpenSpec，而不是在实现阶段临时补定义。

## Execution Slices

### Slice 1: Data Model And Migration

目标：
- 为自动化主体、触发器、执行记录建立可迁移的数据基线。

涉及文件 / 子系统：
- `app/work/src/main/db/schema.ts`
- `app/work/src/main/db/migrations/*.sql`
- `app/work/src/main/db/migrations/meta/*.json`

实现步骤：
1. 在 `schema.ts` 中新增 `automations`、`automationTriggers`、`automationRuns` 表，并建立与 `workspaces`、`sessions` 的外键关系。
2. 为自动化状态、触发器类型、运行类型、运行状态选择清晰且稳定的文本枚举值。
3. 生成新的 migration 与 snapshot，确保打包与开发环境都能执行。
4. 自检字段是否覆盖 OpenSpec 中的 `last_scheduled_at`、`last_run_at`、`last_completed_at`、`scheduled_for`、`run_kind`、`status`。

验证：
- 检查 migration 文件与 schema 字段一一对应。
- 启动应用或运行最小数据库初始化流程，确认 migration 能成功执行。

停手条件：
- 数据表和 migration 已完整落地，且没有遗漏补偿执行与列表展示所需字段。

### Slice 2: DAO And Automation Service

目标：
- 建立自动化读写、运行记录和调度编排的主进程基础服务。

涉及文件 / 子系统：
- `app/work/src/main/service/dao/automation.dao.service.ts`
- `app/work/src/main/service/dao/automation-trigger.dao.service.ts`
- `app/work/src/main/service/dao/automation-run.dao.service.ts`
- `app/work/src/main/service/automation.service.ts`
- `app/work/src/main/service/automation-scheduler.service.ts`
- `app/work/src/main/service/workspace.service.ts`
- `app/work/src/main/service/session.service.ts`
- `app/work/src/main/service/agent.service.ts`
- `app/work/src/main/app.module.ts`

实现步骤：
1. 参照现有 DAO 模式补齐 automation 相关 DAO，覆盖列表、详情、创建、更新、删除、按状态查询、写入运行记录。
2. 新增 `AutomationScheduler`，仅封装 `node-cron` 的 register / reschedule / unregister 生命周期。
3. 新增 `AutomationService`，承担以下职责：
   - 自动化 CRUD
   - cron 表达式合法性校验
   - 启用状态变更后的调度同步
   - 应用启动后的启用中自动化恢复
   - 漏跑补偿判断
   - 单自动化互斥执行
4. 按设计默认策略接入执行链路：为自动化运行创建新会话，再把 `prompt` 发送到 AI 运行时。
5. 在运行前后更新 `automations` 和 `automation_runs` 的时间与状态字段。
6. 在 `AppModule` 中注册新 DAO / service，并在应用 ready 阶段触发自动化恢复。

验证：
- 为 service 层准备最小手工验证路径：创建一条启用自动化后，能完成注册；删除或禁用后，能完成注销。
- 用一个高频 cron 表达式验证单次触发能落运行记录，并关联会话。
- 手工模拟 `last_scheduled_at` 落后于当前时间，验证只补最后一个计划点。

停手条件：
- 自动化在主进程内能被创建、恢复、执行、注销，且补偿规则符合 OpenSpec。

### Slice 3: Shared Contracts, IPC, And Preload

目标：
- 为 renderer 和主进程之间建立自动化统一接口。

涉及文件 / 子系统：
- `app/work/src/shared/api.ts`
- `app/work/src/shared/constants.ts`
- `app/work/src/shared/index.ts`
- `app/work/src/preload/preload.ts`
- `app/work/src/main/controllers/automation/*.ts`
- `app/work/src/main/controllers/ipc.base.controller.ts`
- `app/work/src/main/app.module.ts`

实现步骤：
1. 在 shared API 中新增自动化实体、触发器实体、运行摘要以及 CRUD request / response 类型。
2. 在 constants 中新增自动化相关 IPC channel。
3. 新增自动化控制器，至少覆盖 list / get / create / update / delete。
4. 在 preload 中暴露对应的 `electronAPI` 方法。
5. 在 `IRenderHook` 所在共享类型入口同步补齐声明，避免 renderer 侧类型漂移。

验证：
- TypeScript 编译通过，renderer 可以正常调用新增 `electronAPI` 方法。
- 手工调用每个 controller，确认错误信息能在 cron 非法、workspace 不存在时正确返回。

停手条件：
- 主进程与 renderer 之间的自动化接口完整可用，且类型定义单一来源明确。

### Slice 4: AI Tools Integration

目标：
- 让 AI 可对自动化执行结构化增删查改。

涉及文件 / 子系统：
- `packages/core/src/tools/*`
- `packages/core/src/tools/index.ts`
- `packages/core/src/core-agent.ts`
- `app/work/src/main/service/automation.service.ts`
- 如需桥接：自动化 tool service 或 adapter 文件

实现步骤：
1. 定位 `createAllTools` 的扩展点，新增 automation 工具定义。
2. 为 `automation_list`、`automation_get`、`automation_create`、`automation_update`、`automation_delete` 实现统一 schema 和结果格式。
3. 将 cron 校验、workspace 校验和受支持 trigger 校验统一复用 `AutomationService`，避免 UI、IPC、tools 三套逻辑分叉。
4. 为工具返回补充用户可读摘要字段，便于 AI 在会话中确认创建结果。

验证：
- 确认工具已出现在系统 prompt 的工具列表中。
- 手工调用工具，验证成功返回和非法输入报错都符合预期。

停手条件：
- AI 可以通过 tools 完整管理自动化，且输入校验与主进程服务保持一致。

### Slice 5: Renderer Store And Page Skeleton

目标：
- 建立自动化页的数据加载、空状态和列表骨架。

涉及文件 / 子系统：
- `app/work/src/renderer/src/pages/auto/Auto.vue`
- `app/work/src/renderer/src/stores/automation.ts`
- `app/work/src/renderer/src/lib/ipc.ts`
- 如需新增：`app/work/src/renderer/src/components/automation/*`

实现步骤：
1. 新建 automation store，封装列表加载、创建、更新、删除、状态刷新。
2. 重写 `/auto` 页面，加入标题说明、右上角“添加自动化”按钮和加载逻辑。
3. 当列表为空时展示空状态引导；非空时展示自动化列表。
4. 列表项至少呈现标题、工作空间、cron 摘要、提示词摘要、启用状态和最近运行摘要。

验证：
- 页面首次进入时能加载列表。
- 空列表和非空列表两种状态切换正确。

停手条件：
- `/auto` 页面已具备稳定的数据展示骨架，不再是占位页。

### Slice 6: shadcn-vue Create Dialog And Preview

目标：
- 完成自动化创建交互和实时预览。

涉及文件 / 子系统：
- `app/work/src/renderer/src/layout/dialog/automation-form/*`
- `app/work/src/renderer/src/layout/dialog/index.ts`
- `app/work/src/renderer/src/pages/auto/Auto.vue`
- `app/work/src/renderer/src/components/ui/*`

实现步骤：
1. 参考现有 dialog 结构新增自动化创建弹窗组件。
2. 使用仓库已有 shadcn-vue 组件实现工作空间选择、cron 输入、提示词输入和确认按钮。
3. 在表单内构建预览卡片，实时展示工作空间、触发器摘要、提示词摘要和自动生成标题。
4. 提交成功后关闭弹窗并刷新列表。
5. 对非法 cron、缺失工作空间、空提示词给出明确表单反馈。

验证：
- 点击右上角按钮能打开弹窗。
- 输入变化时预览实时更新。
- 提交成功后列表新增自动化。
- 非法输入时不能提交，并显示错误提示。

停手条件：
- 创建流从入口、表单、预览到列表刷新完整闭环。

### Slice 7: End-To-End Verification And Regression Check

目标：
- 以用户视角验证自动化从创建到调度再到恢复的完整路径。

涉及文件 / 子系统：
- 全链路验证，不限定单文件

执行步骤：
1. 运行 `pnpm lint`。
2. 运行相关构建命令，至少覆盖受影响包和应用入口。
3. 使用 `pnpm dev` 进行手工验证，覆盖：
   - 空状态
   - 创建自动化
   - 删除或禁用自动化
   - 正常定时触发
   - 应用退出后漏跑一次与漏跑多次的补偿执行
   - AI tools CRUD
4. 记录未覆盖的自动化测试缺口，作为 `workflow-close` 输入。

验证：
- lint 通过。
- 受影响构建通过。
- 手工验证结果与 OpenSpec 成功标准一致。

停手条件：
- 已拿到最终验证结果，能够进入 `workflow-close` 或继续修复明确缺陷。

## Recommended Order

1. Slice 1
2. Slice 2
3. Slice 3
4. Slice 4
5. Slice 5
6. Slice 6
7. Slice 7

## Notes For `workflow-implement`

- 先完成主进程底座，再接 UI；不要先做 `/auto` 页面。
- cron 校验和漏跑时间点计算必须复用同一语义来源。
- 如果实现中需要改变“每次触发创建新会话”的默认执行策略，必须回退到 `workflow-spec` 更新 OpenSpec 后再继续。
