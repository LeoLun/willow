# Work 自动化能力实施方案

> 本文档是供后续 agent 直接实施的交接方案。实施时必须遵守仓库根目录与
> `apps/work/AGENTS.md` 的约束，并保留当前工作树中与本需求无关的用户修改，尤其是
> `FileSearchPanel.vue` 与 `SkillSearchPanel.vue`。

## 目标

- 在 Electron 主进程中新增持久化的 cron 自动化调度能力。
- 自动化页面支持创建、编辑、启停、立即执行、删除和查看完整执行历史。
- 每次运行创建独立会话并发送配置的提示词。
- Willow 退出或系统休眠期间只补偿最近一次漏跑，不逐次重放。
- 无人值守执行使用 AI 代审；无法自动处理的权限或用户问题以失败结束，不遗留等待状态。

## 技术基线

- 使用 `node-cron` v4 注册、更新和注销运行时任务。
- 使用 `cron-parser` 的公开 API 校验表达式、计算下一次执行和最近漏跑时间，不使用
  `node-cron` 私有模块。
- cron 统一采用五段、分钟级格式：`minute hour day-of-month month day-of-week`。
- 创建自动化时记录当前系统的 IANA 时区；时区随后保持固定，本期只展示、不提供修改入口。
- Vue 页面使用 Composition API、`<script setup lang="ts">` 和现有 DialogProvider；状态沿用当前
  页面级 composable 模式，不新增 Pinia store。

## 数据模型与迁移

新增 Drizzle migration 和以下三张表。

### `automations`

- `id`：自增主键。
- `workspace_id`：关联 `workspaces.id`，工作空间删除时级联删除自动化。
- `title`、`prompt`。
- `status`：`enabled | disabled`，默认 `enabled`。
- `model_provider_id`、`model_id`：均可为空；为空表示执行时跟随当前默认大模型。
- `last_scheduled_at`：最近一次已处理的 cron 计划时间，不受运行成功与否影响。
- `last_run_at`、`last_completed_at`。
- `created_at`、`updated_at`。

### `automation_triggers`

- `id`：自增主键。
- `automation_id`：关联 `automations.id` 并级联删除，添加唯一索引以保证一对一。
- `type`：首期固定为 `schedule`。
- `cron_expression`、`timezone`、`is_active`。
- `created_at`、`updated_at`。

### `automation_runs`

- `id`：自增主键。
- `automation_id`：关联 `automations.id` 并级联删除。
- `session_id`：可空，关联 `sessions.id`，会话删除时置空。
- `run_kind`：`scheduled | catch_up | manual`。
- `status`：`running | completed | failed | skipped | interrupted`。
- `scheduled_for`、`triggered_at`、`finished_at`。
- `error_message`：可空，只存放适合展示给用户的归一化错误。
- `created_at`、`updated_at`。
- 添加 `(automation_id, triggered_at, id)` 倒序查询所需索引。

删除自动化时同时删除触发器和运行历史，但保留已经生成的聊天会话。执行历史不自动清理，通过分页
控制读取成本。

## 主进程服务

### DAO 与事务

- 新增 automation、trigger、run DAO，保持与现有 DAO 命名和注入方式一致。
- 创建自动化时，automation 与 trigger 必须在同一个数据库事务中写入。
- 更新工作空间、模型、cron、时区和状态时先完成全部校验，再持久化并刷新调度注册。
- 删除运行中的自动化返回冲突错误，避免运行记录被级联删除后后台任务继续更新不存在的数据。

### 调度器

新增 `AutomationSchedulerService`，内部维护 `Map<automationId, ScheduledTask>`，提供：

- `register` / `reschedule`：先注销旧任务，再用最新 cron 和时区注册。
- `unregister`：停止并销毁单个任务。
- `unregisterAll`：应用退出时清理所有任务。

同一自动化使用进程内 automation-id 锁防止并发执行，不使用数据库中的 `running` 记录作为跨进程
锁。不同自动化允许并行运行。

发生重叠触发时：

- 不启动第二个会话。
- 创建一条 `skipped` 运行记录并写入“上一轮仍在执行”的用户可读原因。
- 更新 `last_scheduled_at`，避免重启后又把该时间点当作漏跑补偿。

### 启动、休眠恢复与退出

在 `AppModule` 中注入自动化服务：

1. 数据库迁移完成后，将上次进程遗留的 `running` 记录更新为 `interrupted`，写入结束时间和说明。
2. 加载全部 `enabled` 且 trigger 激活的自动化。
3. 注册后续 cron 任务，并在相同的单自动化串行保护下安排漏跑检查。
4. 监听 Electron `powerMonitor` 的 `resume`，再次检查漏跑并确保调度仍已注册。
5. `before-quit` 时注销所有任务，将仍活动的运行收口为 `interrupted`，再关闭数据库。

漏跑规则：

- 以 `max(created_at, last_scheduled_at)` 为锚点。
- 使用 `cron-parser` 在自动化时区中求当前时间之前最近的计划点。
- 最近计划点晚于锚点时只执行这一条 `catch_up`，更早的计划点全部忽略。
- Willow 完全退出期间不会由操作系统自动唤醒。

### CRUD 与 cron 校验

`AutomationService` 负责 CRUD、恢复调度、漏跑判断和执行编排。创建与更新必须校验：

- 工作空间存在。
- 标题可为空；为空时从压缩后的 prompt 截取前 24 个字符，最终兜底为“未命名自动化”。
- prompt 去除首尾空格后非空。
- status、trigger type 属于支持的枚举。
- cron 恰好五段，且同时通过 `node-cron` 和 `cron-parser`。
- 时区是有效 IANA 标识。
- 固定模型同时包含 providerId/modelId，且 `AgentService` 可以解析；两者都为空时表示跟随默认模型。

状态变化行为：

- 创建为 enabled：持久化成功后注册任务。
- enabled 更新 cron：重新注册。
- disabled：注销任务，但当前已经开始的运行继续完成。
- 编辑运行中的自动化只影响下一次执行。
- “立即执行”只允许已保存且 enabled 的自动化。

## 无人值守执行

每次 scheduled、catch-up 或 manual 运行：

1. 创建 `running` 记录，并更新计划锚点；manual 不更新 cron 计划锚点。
2. 解析固定模型，或读取执行当时的默认大模型。无可用模型时将运行标记为 failed。
3. 创建标题为 `[自动化] <自动化名称>` 的新会话。
4. 把内部 session 主键写入 run，再调用现有 `MessageService` 发送 prompt。
5. 成功时记录 completed、finishedAt 和 lastCompletedAt；异常时记录 failed 与归一化错误。

扩展 `MessageService` 的仅限主进程内部输入，增加不可由 renderer IPC 设置的
`interactionMode: "interactive" | "unattended"`，默认 interactive，确保普通聊天完全兼容。

unattended 行为：

- 固定使用 `delegate-approval`。
- AI 审批通过时允许工具调用。
- AI 审批拒绝、超时、返回无效结果或缺少小模型时抛出无人值守交互错误，不回退到人工审批。
- `ask-user` 直接抛出无人值守交互错误，不创建持久化的待回答问题。
- 上述错误由自动化服务捕获，并将 run 标记为 failed。

错误历史不得包含凭据或工具原始敏感参数；未知错误转换为固定通用文案。

## Shared API、IPC 与事件

在 `src/shared/api.ts` 定义：

- `AutomationStatus = "enabled" | "disabled"`
- `AutomationTriggerType = "schedule"`
- `AutomationScheduleMode = "daily_at" | "hourly" | "weekly_at" | "custom"`
- `AutomationRunKind = "scheduled" | "catch_up" | "manual"`
- `AutomationRunStatus = "running" | "completed" | "failed" | "skipped" | "interrupted"`
- `Automation`、`AutomationTrigger`、`AutomationRun` 和 CRUD 输入输出类型。

公开 renderer 方法：

- `listAutomations()`
- `getAutomation({ id })`
- `createAutomation(request)`
- `updateAutomation(request)`
- `deleteAutomation({ id })`
- `runAutomationNow({ id })`
- `listAutomationRuns({ automationId, cursor?, limit? })`

历史接口默认返回 20 条、最大 100 条，按 `triggeredAt DESC, id DESC` 使用稳定游标分页，并返回
`nextCursor`。run 中对 renderer 暴露的是 agent session id 字符串及 workspaceId，而不是数据库内部
session 主键，便于直接路由到聊天。

按 `apps/work/AGENTS.md`：

- 每个 IPC controller 位于 `src/main/controllers/automation/`，继承 `IPCBaseController`。
- 在 `constants.ts` 定义事件名，在独立 `automation.hook.ts` 定义接口，并合入 `IRenderHook`。
- preload 只暴露上述窄接口。
- controller 必须校验 id、cursor、limit、枚举、字符串和嵌套 trigger 输入，无效参数返回 400 且不调用服务。

新增 `AUTOMATION_CHANGED_EVENT`，payload 为：

```ts
type AutomationChangedEvent = {
  automationId: number;
  type: "created" | "updated" | "deleted" | "run-started" | "run-finished";
};
```

CRUD 和运行状态变化时发送事件；renderer 仅刷新受影响的列表、详情或历史。

## Renderer 页面

### `/auto` 列表页

- 使用当前应用页面头部样式，标题为“自动化”，右上角唯一主操作为“添加自动化”。
- 支持 loading、load error、空状态和列表状态。
- 列表行展示名称、工作空间、计划摘要、启停状态、下次执行时间和最近一次运行状态。
- 点击列表行进入 `/auto/:automationId`。
- 行操作提供编辑和删除；删除必须打开统一 DialogProvider 管理的确认弹窗。

### 创建弹窗

新增独立 `AutomationFormDialog.vue`，字段为：

- 名称（可选，可实时显示自动生成结果）。
- 工作空间（必选）。
- 提示词（必填）。
- 模型：跟随默认模型或选择具体 provider/model。
- 初始状态：默认启用。
- 计划模式：每天、每小时、每周、自定义。

快捷模式统一转换为 cron：

- 每天：选择 HH:mm，生成 `minute hour * * *`。
- 每小时：固定 `0 * * * *`。
- 每周：选择一个或多个星期及 HH:mm，生成逗号分隔 weekday。
- 自定义：输入五段 cron，并实时显示校验错误。

弹窗同时展示计划摘要、cron 原文和当前时区。提交期间禁用重复操作；成功后关闭并刷新列表。

### `/auto/:automationId` 详情页

- 支持加载、404 和错误重试状态。
- 编辑名称、工作空间、提示词、模型、状态和计划。
- 提供保存、重置、立即执行、删除；存在未保存修改时禁用立即执行。
- disabled 时禁用立即执行。
- 立即执行创建会话后跳转到对应聊天，用户可查看实时输出。
- 删除成功后返回自动化列表。

### 执行历史

在详情页展示 newest-first 历史列表，包括：

- scheduled/catch-up/manual 类型。
- running/completed/failed/skipped/interrupted 状态。
- 计划时间、实际开始、完成时间和持续时长。
- 可安全展示的失败或跳过原因。
- 会话仍存在时提供“查看会话”，跳转到现有 chat route。
- 首屏 20 条，使用“加载更多”消费 cursor；无记录时展示明确空状态。

监听 `AUTOMATION_CHANGED_EVENT`：列表页刷新对应摘要；详情页更新自动化和第一页历史，不破坏已编辑但
未保存的表单值，必要时只提示后台状态已更新。

## 依赖

在 `apps/work/package.json` 增加：

- `node-cron`
- `cron-parser`

使用 pnpm 更新 lockfile。不要从旧提交复制私有 `TimeMatcher` 导入或旧目录结构代码。

## 测试与验收

### 服务与数据库

- automation + trigger 创建事务和回滚。
- 更新、启停、级联删除、运行中删除冲突。
- 历史稳定游标分页和会话删除后的 nullable 关联。
- 非法工作空间、模型、五段 cron、时区和枚举输入。

### 调度

- 创建/编辑/启停对应注册、重注册和注销。
- 正常 scheduled 触发。
- 启动和 resume 只补最近一次。
- 没有漏跑时不补偿。
- 时区与 DST 边界计算。
- 同自动化重叠产生 skipped，不创建第二会话；不同自动化可并发。
- 进程遗留 running 在启动时变为 interrupted，且不阻止下一次运行。

### 执行和权限

- 每次运行创建独立且标题正确的会话。
- 固定模型与默认模型解析。
- prompt 发送、成功/失败状态和时间字段。
- manual 运行不推进 cron 锚点。
- AI 审批通过、拒绝、失败、超时，以及 ask-user 的无人值守失败收口。
- 普通聊天仍保持原有人工审批和问题恢复行为。

### IPC 与页面

- 每个 controller 覆盖成功、非法输入、不调用服务、missing data、异常透传。
- 列表 loading/error/empty/data 状态。
- 创建和编辑校验、启停、删除确认、立即执行。
- 历史状态、错误、分页和会话跳转。
- 后台事件刷新不覆盖未保存编辑。

### 验证命令

```bash
pnpm --filter Willow test
pnpm --filter Willow typecheck
pnpm --filter Willow lint
pnpm format:check
```

随后运行 `pnpm --filter Willow dev`，必须通过仓库内 Electron 可执行文件确认 renderer 使用
`localhost:5173` 和本仓库的 `apps/work`，手工验证：

1. 创建每天、每周和自定义 cron 自动化。
2. 编辑并启停，确认主进程调度同步变化。
3. 立即执行并跳转到新会话。
4. 验证成功、失败、跳过和 interrupted 历史。
5. 模拟漏跑后启动或系统 resume，只补最近一次。
6. 删除自动化后运行历史消失，但已生成会话仍存在。

## 明确不在本期范围

- 操作系统级 cron、后台守护进程或退出后自动唤醒 Willow。
- 补跑全部历史计划点。
- 示例模板、复制自动化。
- 由 AI 对话调用的 automation 管理 tools。
- 历史自动清理策略。
