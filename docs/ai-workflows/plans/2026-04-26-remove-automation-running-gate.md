# Plan: remove-automation-running-gate

## OpenSpec Inputs

- `docs/ai-workflows/openspec/changes/remove-automation-running-gate/proposal.md`
- `docs/ai-workflows/openspec/changes/remove-automation-running-gate/design.md`
- `docs/ai-workflows/openspec/changes/remove-automation-running-gate/tasks.md`
- `docs/ai-workflows/openspec/changes/remove-automation-running-gate/specs/automation/spec.md`
- `DESIGN.md`

## Implementation Goal

移除自动化执行入口对数据库历史 `automation_runs.status = "running"` 记录的依赖，让 running 记录只作为最近已知运行状态展示，不再作为跨进程锁。应用在自动化执行过程中停止后，下一次手动执行、定时执行和漏跑补偿都不能被历史 running 记录阻止。

## Decisions

1. 采用 OpenSpec 推荐的 Approach B：删除数据库 running 门禁，保留当前进程内 `runningAutomationIds` 短生命周期保护。
2. 不新增数据库迁移，不新增运行状态枚举；`running` 继续存在，但只表示运行记录的最后已知状态。
3. 不清理用户已有 running 记录；实现通过忽略这些记录来恢复可执行性。
4. `AutomationRunDao.findRunningByAutomationId(...)` 如果没有其他调用方，直接删除；同时清理不再需要的 Drizzle `and` import。
5. renderer 不做页面重设计，只确认“立即执行”按钮禁用条件不依赖 `latestRun.status`。若实现阶段改动按钮样式或文案，继续遵守 `DESIGN.md` 的工作台与次级操作规则。

## Execution Slices

### Slice 1: 移除主进程数据库 running 门禁

目标：manual、scheduled、catch_up 三条执行路径都不再查询历史 running 记录来拒绝或跳过本次执行。

涉及文件：

- `app/work/src/main/service/automation.service.ts`

步骤：

1. 在 `runAutomationNow(automationId)` 中保留自动化存在、enabled、trigger active 和 `runningAutomationIds` 当前进程检查。
2. 删除 `runAutomationNow(...)` 中的 `automationRunDao.findRunningByAutomationId(automation.id)` 查询与对应抛错。
3. 在 `executeAutomationRun(...)` 中保留 `runningAutomationIds` 当前进程检查与 `throwOnConflict` 行为。
4. 删除 `executeAutomationRun(...)` 中的 `automationRunDao.findRunningByAutomationId(automation.id)` 查询、warn 和跳过/抛错逻辑。
5. 确认创建 run、创建 session、回填 `sessionId`、后台成功更新 `completed`、失败更新 `failed` 的逻辑不被改动。
6. 确认 manual 路径仍不更新 `lastScheduledAt`，scheduled/catch_up 仍按既有逻辑维护调度锚点。

验证点：

- `automation.service.ts` 中不再出现 `findRunningByAutomationId` 调用。
- “自动化正在执行中”只来自 `runningAutomationIds` 当前进程保护。
- 历史 running 记录不会影响 `runAutomationNow(...)` 或 `runAutomationById(...)`。

### Slice 2: 清理 DAO 和依赖

目标：移除已经不作为执行入口依赖的数据库 running 查询，避免未来误用。

涉及文件：

- `app/work/src/main/service/dao/automation-run.dao.service.ts`

步骤：

1. 删除 `findRunningByAutomationId(automationId)` 方法。
2. 删除不再使用的 `and` import。
3. 保留 `findLatestByAutomationId(...)` 和 `findLatestByAutomationIds(...)`，因为它们仍负责最近运行摘要展示。
4. 全仓搜索 `findRunningByAutomationId`，确认没有残留引用。

验证点：

- TypeScript 不再有未使用 import。
- DAO 仍提供运行记录插入、更新和最近记录查询能力。

### Slice 3: Renderer 行为确认

目标：确认用户界面不会把历史 running 摘要当成执行权限。

涉及文件：

- `app/work/src/renderer/src/pages/auto/detail/AutomationDetail.vue`
- `app/work/src/renderer/src/stores/automation.ts`（只读确认）
- `app/work/src/renderer/src/components/automation/display.ts`（只读确认）

步骤：

1. 检查 `AutomationDetail.vue` 的“立即执行”按钮禁用条件，确认只依赖 `!automation`、`isDirty`、`!isValid`、`isSaving`、`isRunningNow` 等本地交互状态。
2. 确认页面没有根据 `automation.latestRun.status === "running"` 禁用按钮或阻止 `handleRunNow()`。
3. 保留 `isRunningNow` 作为单次点击请求期间的本地 loading/disabled 防重复交互。
4. 确认 `automationStore.runAutomationNow(id)` 只调用 API、更新 list/detail 缓存并返回结果，不读取 latest run 状态决定是否发起请求。
5. 确认 `display.ts` 中 running 文案只用于展示最近运行摘要，不参与执行控制。

验证点：

- renderer 不需要 UI 样式改造。
- 历史 running 摘要最多显示为“运行中”，但不能阻止按钮点击。

### Slice 4: 静态验证与最小运行验证

目标：用命令检查确保改动编译、lint 通过，并覆盖历史 running 记录不再阻塞的关键风险。

命令验证：

1. 运行 `pnpm lint`。
2. 运行 `pnpm build`；如果环境、耗时或外部条件阻塞，记录失败原因和已完成的替代检查。

代码级验证：

1. 全仓搜索 `findRunningByAutomationId`，确认无执行入口调用。
2. 搜索 `latestRun.status`，确认没有 renderer 启动权限判断。
3. 搜索 `自动化正在执行中`，确认只剩当前进程内 `runningAutomationIds` 冲突路径。

手动/数据验证：

1. 使用本地数据库或调试路径制造一条某自动化的历史 `automation_runs.status = "running"` 记录。
2. 打开该自动化详情页，点击“立即执行”，确认会创建新会话并跳转，不再报“自动化正在执行中”。
3. 对同一自动化执行过程中停止应用，重新打开后再次点击“立即执行”，确认可以启动。
4. 如条件允许，触发一次定时执行或 catch-up，确认历史 running 记录不导致跳过。
5. 验证新执行成功后本次运行记录更新为 `completed`；发送失败时更新为 `failed` 和错误信息。

## Stop Conditions

- 如果实现发现除 `AutomationService` 外还有其他模块依赖 `findRunningByAutomationId(...)` 做业务判断，暂停并确认是否属于本次 OpenSpec 范围。
- 如果移除数据库门禁后出现同一进程内重复启动无法由 `runningAutomationIds` 控制的问题，先保持当前进程保护；若仍不满足用户目标，回到 `workflow-spec` 决定是否改为完全移除并发门禁。
- 如果需要新增运行状态如 `interrupted`、`started` 或进行数据库迁移，暂停并回到 `workflow-spec`，因为本次 OpenSpec 明确不要求迁移。
- 如果 renderer 需要改变“运行中”展示文案以避免误导，先判断是否只是展示微调；若涉及新的产品语义，回到 `workflow-spec`。

## Task Mapping

- OpenSpec 1.1：Slice 1 step 2
- OpenSpec 1.2：Slice 1 step 4
- OpenSpec 1.3：Slice 1 step 1、3、5
- OpenSpec 1.4：Slice 1 验证点、Slice 4 手动/数据验证
- OpenSpec 2.1：Slice 2
- OpenSpec 2.2：Slice 3
- OpenSpec 2.3：Slice 1、Slice 4，不新增迁移
- OpenSpec 3.1-3.3：Slice 3
- OpenSpec 4.1-4.6：Slice 4
