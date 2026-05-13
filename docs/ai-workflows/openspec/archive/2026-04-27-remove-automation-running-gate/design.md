# Design: remove-automation-running-gate

## Scope

本设计覆盖 `app/work` 自动化执行链路中的并发判断、运行记录状态写入、立即执行错误反馈，以及定时执行/漏跑补偿与运行记录的关系。

相关既有规格：

- `docs/ai-workflows/openspec/archive/add-automation-feature/`
- `docs/ai-workflows/openspec/archive/add-automation-run-now/`

本次不涉及 renderer 页面重设计；如果实现阶段改动自动化详情页按钮状态或文案，仍需遵守仓库根 `DESIGN.md`。

## Current Behavior

当前自动化执行前存在两类“正在执行”判断：

- `AutomationService.runningAutomationIds`：进程内 `Set<number>`，用于当前进程生命周期内判断某条自动化是否正在执行。
- `AutomationRunDao.findRunningByAutomationId(...)`：查询数据库中 `automation_runs.status = "running"` 的最新记录，并用它拒绝新的执行。

数据库 running 记录在执行启动时写入，正常完成后更新为 `completed`，失败时更新为 `failed`。如果应用在执行中停止，后台 `finally` 不能执行，数据库 running 记录会残留。下一次执行时，DAO 查询会把这条历史记录当作仍在运行，导致用户持续收到“自动化正在执行中”。

## Target Semantics

自动化运行记录是事实记录，不是跨进程锁。

- `automation_runs` 可以记录一次执行曾经启动过、最终完成或失败。
- 历史 `status = "running"` 记录不得阻止任何新的手动执行、定时执行或漏跑补偿。
- 应用重启后不恢复“自动化正在执行”业务状态。
- 执行过程中停止应用时，下一次启动不需要先清理 running 记录才能继续执行。
- 同一进程内的短生命周期重复触发保护可以保留，但它只能来自内存状态，并且必须在正常完成、失败或启动异常时释放。

## Service Changes

`AutomationService.runAutomationNow(...)` 应移除数据库 running 门禁：

- 不再调用 `automationRunDao.findRunningByAutomationId(...)` 来决定是否抛出“自动化正在执行中”。
- 允许在存在历史 running 记录时创建新的 manual 运行记录和新会话。
- 可以继续使用 `runningAutomationIds` 拦截当前进程内同一自动化的重复立即执行。

`AutomationService.executeAutomationRun(...)` 应同样移除数据库 running 门禁：

- 定时执行和 catch-up 不再因为历史 running 记录而跳过。
- 如果当前进程内已有同一自动化执行，是否跳过仍由 `runningAutomationIds` 控制。
- `throwOnConflict` 只表达进程内冲突，不表达数据库历史状态冲突。

`AutomationRunDao.findRunningByAutomationId(...)` 不应再作为自动化执行入口的门禁依赖。实现可以：

- 删除该 DAO 方法；或
- 保留方法但确保执行入口不再调用它。

## Run Record Semantics

启动新执行时仍可写入 `automation_runs`：

- `runKind`: `scheduled`、`catch_up` 或 `manual`
- `status`: 启动时可以继续写入 `running`
- `sessionId`: 创建会话后回填
- 成功后更新为 `completed`
- 失败后更新为 `failed` 并写入 `errorMessage`

本次关键约束是：`running` 只表示该条记录的最后已知状态，不表示系统中存在一个仍需被尊重的持久化执行锁。

如果实现者希望进一步减少歧义，可以在后台发送启动后立即把记录状态调整为非 `running` 的中间语义，但当前类型只有 `running | completed | failed`，本次不要求新增状态或迁移表结构。

## Existing Historical Records

已有数据库中残留的 `running` 记录不需要迁移。

- 自动化列表或详情页可以继续把最近一次历史记录显示为“运行中”。
- 该展示不得影响“立即执行”按钮能否发起请求。
- 新执行启动后，最新运行摘要会被新的运行记录自然覆盖。

如果实现阶段发现“运行中”展示会误导用户，可以在 renderer 中将历史 running 的文案调整为更中性的“上次执行未结束”，但这不是本次必须项。

## Error Behavior

执行入口仍应校验：

- 自动化存在。
- 自动化为 enabled 且 trigger active。
- 工作空间、模型和 prompt 发送链路可用。

不应再因为数据库中存在 running 记录返回“自动化正在执行中”。

如果当前进程内 `runningAutomationIds` 命中，可以继续返回“自动化正在执行中”，但该错误只允许代表本进程正在执行的短期状态。应用重启后该状态必须消失。

## Verification Notes

实现验证应覆盖：

- 人工制造一条 `automation_runs.status = "running"` 的历史记录后，立即执行仍成功启动。
- 执行过程中停止应用，重新打开后同一自动化可以再次立即执行。
- 定时执行路径不再因为历史 running 记录跳过。
- 正常完成仍把本次运行记录更新为 `completed`。
- 发送失败仍把本次运行记录更新为 `failed`。
