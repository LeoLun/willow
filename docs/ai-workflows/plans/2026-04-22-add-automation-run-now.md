# Plan: add-automation-run-now

## OpenSpec Inputs

- `docs/ai-workflows/openspec/changes/add-automation-run-now/proposal.md`
- `docs/ai-workflows/openspec/changes/add-automation-run-now/design.md`
- `docs/ai-workflows/openspec/changes/add-automation-run-now/tasks.md`
- `docs/ai-workflows/openspec/changes/add-automation-run-now/specs/automation/spec.md`
- `DESIGN.md`

## Implementation Goal

为自动化详情页新增“立即执行”入口，并通过显式 IPC/API 调用主进程自动化服务，复用现有执行链路、运行记录、错误记录和并发保护。立即执行使用已保存配置，不自动保存当前表单，不改变 cron 注册，不推进用于漏跑补偿的 `lastScheduledAt`。

2026-04-23 OpenSpec 更新：立即执行不应等待 `sessionService.sendMessage(...)` 完整完成后才返回。手动执行必须在创建本次执行 session、写入 running run、启动后台发送后立即返回 `{ automation, session }`；renderer 随后刷新左侧会话列表并跳转到该 session。

## Decisions

1. 使用 OpenSpec 推荐的 Approach B：新增 `RUN_AUTOMATION_NOW` IPC，而不是在 renderer 中直接创建会话或等待下一次 cron。
2. 新增 `manual` 作为 `AutomationRunKind`。当前数据库 `run_kind` 是 text 字段，不需要 schema 结构迁移；实现只补齐 TypeScript 类型、服务写入和展示标签。
3. 保留 `runAutomationById(...)` 作为定时与补偿执行入口，并提取内部执行方法。定时与补偿继续维护 `lastScheduledAt`；手动执行只维护 `lastRunAt`、`lastCompletedAt` 和 `automation_runs`。
4. 手动执行默认只允许 `enabled` 且 trigger active 的自动化运行；disabled 自动化返回错误，不自动启用。
5. 详情页“立即执行”按钮在有未保存修改时禁用，按钮文案和 toast 明确表达执行状态。
6. 手动执行 API 的返回时机是“执行已启动”，不是“执行已完成”。返回值包含自动化详情与新建 session。
7. renderer 成功收到响应后刷新 `sessionStore.fetchSessionList([session.workspaceId])`，再跳转到 `/${session.id}`。

## Execution Slices

### Slice 1: Shared API And IPC Contract

目标：让 renderer、preload、主进程拥有一致的手动执行合约。

涉及文件：

- `app/work/src/shared/api.ts`
- `app/work/src/shared/hook/automation.hook.ts`
- `app/work/src/shared/constants.ts`
- `app/work/src/preload/preload.ts`

步骤：

1. 在 `AutomationRunKind` union 中加入 `"manual"`。
2. 新增 `RunAutomationNowRequest { id: number }` 与 `RunAutomationNowResponse { automation: Automation }`。
3. 在 `IAutomationApi` 添加 `runAutomationNow(request)`。
4. 新增 `RUN_AUTOMATION_NOW` 常量。
5. 在 preload 的自动化 API 段新增 `runAutomationNow`，沿用现有 `get/create/update/deleteAutomation` 的 `ApiResponse` 检查和错误抛出模式。

验证点：

- TypeScript import/export 不产生未使用类型。
- preload 方法名与 hook、store 后续调用名一致。

### Slice 2: Main Process Controller Registration

目标：新增 IPC controller，并接入依赖注入模块。

涉及文件：

- `app/work/src/main/controllers/automation/run.automation.now.controller.ts`
- `app/work/src/main/app.module.ts`

步骤：

1. 参考 `update.automation.controller.ts` 新建 `RunAutomationNowController`。
2. controller 校验 `request.id`，缺失时返回 `400` 和可理解错误。
3. controller 调用 `automationService.runAutomationNow(request.id)` 并返回 `{ automation }`。
4. 在 `app.module.ts` 中 import controller，加入 `controllers` 数组和构造函数注入列表，保持现有自动化 controller 的排列顺序。

验证点：

- IPC decorator 使用 `RUN_AUTOMATION_NOW`。
- controller 的 response 类型使用 `RunAutomationNowResponse`。

### Slice 3: Automation Service Execution Semantics

目标：复用执行链路，同时保证手动执行不污染 cron 补偿锚点。

涉及文件：

- `app/work/src/main/service/automation.service.ts`
- `app/work/src/renderer/src/components/automation/display.ts`
- 视情况只读确认：`app/work/src/main/db/schema.ts`

步骤：

1. 将 main 侧 `AutomationRunKind` union 扩展为 `"scheduled" | "catch_up" | "manual"`。
2. 新增 `runAutomationNow(id)`：
   - 校验自动化存在。
   - 校验自动化为 `enabled` 且 trigger active。
   - 使用 `now` 作为 `scheduledFor` 和 `triggeredAt`。
   - 调用内部执行方法，传入 `runKind: "manual"` 与 `updateScheduleAnchor: false`。
   - 执行结束后返回 `getAutomation(id)` 的最新详情。
3. 提取内部执行方法，例如 `executeAutomationRun(...)`：
   - 保留原有创建 run、创建 session、发送 prompt、完成/失败记录逻辑。
   - 并发检测继续使用 `runningAutomationIds` 与 DAO running run 查询。
   - 对 scheduler 场景保持现有 warn-and-skip 行为，避免定时任务因为一次冲突抛错影响 cron handler。
   - 对 manual 场景抛出可理解错误，例如“自动化正在执行中”。
4. 调整 `runAutomationById(...)` 让 scheduled/catch_up 调用内部方法，且 `updateScheduleAnchor: true`。
5. 更新成功路径：
   - 所有运行都更新 `lastRunAt`。
   - scheduled/catch_up 更新 `lastScheduledAt`。
   - manual 不更新 `lastScheduledAt`。
   - 所有成功运行都更新 `lastCompletedAt`。
6. 更新 `getAutomationRunKindLabel(...)`：`manual` 显示“手动执行”，`catch_up` 显示“补跑”，默认 scheduled 显示“按计划运行”。

验证点：

- 立即执行失败仍会写入 failed run。
- 手动执行不会调用 `automationSchedulerService.register/reschedule/unregister`。
- `lastScheduledAt` 只在 scheduled/catch_up 路径更新。

### Slice 4: Renderer Store And Detail Page

目标：在详情页提供符合 `DESIGN.md` 的右上角入口和状态反馈。

涉及文件：

- `app/work/src/renderer/src/stores/automation.ts`
- `app/work/src/renderer/src/pages/auto/detail/AutomationDetail.vue`

步骤：

1. 在 store 中新增 `runAutomationNow(id)` action：
   - 调用 `electronAPI.runAutomationNow({ id })`。
   - 用返回的 `automation` 更新 `automationDetails`。
   - 替换 `automationList` 中对应条目。
   - 返回更新后的 automation。
2. 在详情页新增 `isRunningNow` 状态和 `handleRunNow()`。
3. `handleRunNow()` guard：
   - 无 automation 时返回。
   - `isDirty` 为 true 时返回。
   - `!isValid`、`isSaving` 或 `isRunningNow` 时返回。
4. 调用 store action 后，用返回值更新本地表单状态：
   - 若当前没有未保存修改，可调用 `applyFormState(updatedAutomation)`，让最新运行摘要和表单基线同步。
   - 需要避免在用户编辑中覆盖未保存内容；按钮禁用条件已保证常规路径不会发生。
5. 在 `MainTitle #extra` 中新增按钮：
   - 使用 `Button variant="outline" size="sm" class="h-7"`。
   - 图标使用 `Play` 或 `Loader2`，来自 `lucide-vue-next`。
   - 文案为“立即执行”，执行中为“执行中...”。
   - 禁用条件：`!automation || isDirty || !isValid || isSaving || isRunningNow`。
   - 放在“重置”和“保存”附近，保持“保存”为主操作。
6. 成功 toast 建议使用“执行完成”；失败 toast 展示错误 message 或“执行失败”。

验证点：

- 有未保存修改时按钮禁用，且不会触发 API。
- 成功后右侧“上次运行”和底部最新运行说明更新。
- loading 状态不会撑高或挤压头部操作区。

### Slice 5: Verification And Manual Checks

命令验证：

1. 运行 `pnpm lint`。
2. 运行 `pnpm build`。如果耗时或环境阻塞，记录失败原因和已完成的较小范围检查。

手动验证：

1. 启动应用后打开自动化详情页，确认右上角出现次级“立即执行”按钮。
2. 对一条 enabled 自动化点击立即执行，确认按钮进入 loading，完成后 toast 成功，最新运行摘要刷新。
3. 编辑 prompt 或 title 但不保存，确认立即执行按钮禁用。
4. 停用自动化后确认立即执行不可执行或返回错误反馈，不自动启用。
5. 尝试运行中重复点击，确认同一自动化不会并发启动第二次。
6. 观察/检查 `lastScheduledAt` 未因 manual 运行被推进；定时任务后续仍按 cron 执行。

### Slice 6: Return Session After Start And Navigate

目标：修正当前“详情页一直执行中”的交互。立即执行启动成功后立刻进入本次执行会话，并刷新左侧会话列表；AI 后台继续执行并更新运行记录。

涉及文件：

- `app/work/src/shared/api.ts`
- `app/work/src/main/controllers/automation/run.automation.now.controller.ts`
- `app/work/src/main/service/automation.service.ts`
- `app/work/src/renderer/src/stores/automation.ts`
- `app/work/src/renderer/src/pages/auto/detail/AutomationDetail.vue`
- `app/work/src/renderer/src/stores/session.ts`（只读或调用现有 action）
- `app/work/src/renderer/src/router.ts`（只读确认 session 路由）

步骤：

1. 更新共享类型：
   - 从 `@shared/api` 复用已有 `Session` 类型。
   - 将 `RunAutomationNowResponse` 改为 `{ automation: Automation; session: Session }`。
2. 调整 controller：
   - `RunAutomationNowController` 继续校验 id。
   - 接收 `automationService.runAutomationNow(id)` 返回的 `{ automation, session }`。
   - 返回完整响应，不再只返回 automation。
3. 调整服务层手动执行返回时机：
   - 保留 scheduled/catch_up 当前等待完成的行为，避免影响 cron 调度与补偿逻辑。
   - 为 manual 路径新增专用启动方法，或让 `executeAutomationRun(...)` 支持 `returnAfterStart`。
   - 手动路径先完成并发校验、创建 running run、创建 session、写入 `sessionId`、更新 `lastRunAt`。
   - 启动 `sessionService.sendMessage(session.id, ...)`，但用后台 promise 继续处理完成/失败，不 `await` 到 IPC 返回之后。
   - 后台成功时更新 run 为 `completed`、更新 `lastCompletedAt`。
   - 后台失败时更新 run 为 `failed` 和 `errorMessage`，并释放 `runningAutomationIds`。
   - 无论成功或失败，`runningAutomationIds.delete(automation.id)` 必须在后台 finally 中执行。
   - manual 路径返回 `this.getAutomation(automationId)` 和新建 `session`，其中 automation 最新运行摘要应至少包含 running/manual run 和 session id。
4. 清理实现细节：
   - 移除调试输出，例如 `console.log("runningRun", runningRun)`。
   - 确保 manual 路径不更新 `lastScheduledAt`。
   - 运行中冲突仍返回“自动化正在执行中”一类可理解错误。
5. 调整 store：
   - `automationStore.runAutomationNow(id)` 接收 `{ automation, session }`。
   - 继续更新 `automationDetails` 与 `automationList`。
   - 返回完整 `{ automation, session }`。
6. 调整详情页：
   - import/use `useSessionStore`。
   - `handleRunNow()` 成功后调用 `sessionStore.fetchSessionList([session.workspaceId])`。
   - 成功后 `router.push(\`/${session.id}\`)`。
   - toast 文案改为“已开始执行”。
   - 不再使用“执行完成”作为点击成功反馈。
   - 成功路径可以用返回的 automation 更新表单基线，但跳转前不要求等待后台完成。
7. 保持禁用规则：
   - `!automation || isDirty || !isValid || isSaving || isRunningNow` 时不可点击。
   - 启动请求返回或失败后恢复 `isRunningNow`；成功跳转时无需留在详情页等待后台执行。

验证点：

- `runAutomationNow` 的 TypeScript 返回值在 preload、hook、store、controller、页面中一致。
- 点击后按钮只在启动请求阶段短暂 loading；创建 session 后跳转到 `/:sessionId`。
- 左侧会话列表刷新并包含新会话。
- 会话页可通过现有 active stream / event 机制继续展示自动化执行消息。
- 自动化运行记录先是 `running/manual + sessionId`，后台完成后变为 `completed` 或 `failed`。
- `lastScheduledAt` 未因 manual 运行改变。

## Stop Conditions

- 如果实现发现当前数据库或迁移工具实际对 `run_kind` 有枚举约束，暂停并回到 `workflow-spec` 明确是否允许 schema migration。
- 如果 `sessionService.sendMessage(...)` 无法安全后台启动，或离开 await 后无法通过现有 event/active stream 机制在会话页恢复执行状态，暂停并回到 `workflow-spec` 明确需要的事件/流管理语义。
- 如果产品希望 disabled 自动化也能手动运行，暂停并回到 `workflow-spec` 修订执行前置条件。

## Task Mapping

- OpenSpec 1.1-1.4：Slice 1
- OpenSpec 1.5：Slice 2
- OpenSpec 2.1-2.5：Slice 3
- OpenSpec 3.1-3.5：Slice 4
- OpenSpec 4.1-4.6：Slice 5
- OpenSpec 5.1-5.6：Slice 6

## Handoff

进入 `workflow-implement` 后，如果 Slice 1 到 Slice 4 已经在工作区中完成，则直接执行 Slice 6，并重新跑 Slice 5 的验证。若执行语义与 OpenSpec 冲突，先回到 `workflow-spec` 补齐需求，不在代码中临时扩展行为。
