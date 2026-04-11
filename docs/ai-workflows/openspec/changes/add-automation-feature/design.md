# Design

## Scope

本次设计覆盖：

- 自动化持久化模型
- 基于 `node-cron` 的调度恢复与补偿执行
- 自动化页面与创建弹窗交互
- 自动化 CRUD 的 IPC / 服务接口与 AI tools 封装

## Architecture Overview

自动化能力按以下层次组织：

1. 数据层
   - `automations`：自动化主体
   - `automation_triggers`：触发器定义，首期仅 `schedule`
   - `automation_runs`：计划执行与补偿执行记录
2. 主进程服务层
   - DAO：负责自动化、触发器、执行记录的读写
   - AutomationService：负责 CRUD、调度注册、启动恢复、补偿判断、触发执行
   - AutomationScheduler：对 `node-cron` 的注册/注销进行封装
3. IPC / preload
   - 面向渲染进程提供自动化列表、详情、创建、更新、删除接口
4. Renderer
   - 自动化列表页
   - 空状态引导
   - 创建 / 编辑弹窗，使用 shadcn-vue 组件实现
5. AI tools
   - 自动化工具集暴露 list / get / create / update / delete 能力

## Data Model

### `automations`

建议字段：

- `id`
- `workspace_id`
- `title`
- `prompt`
- `status`
  - `enabled`
  - `disabled`
- `trigger_type`
  - 首期固定为 `schedule`
- `last_scheduled_at`
  - 最近一次应执行的计划时间点
- `last_run_at`
  - 最近一次实际开始执行的时间
- `last_completed_at`
  - 最近一次成功完成时间
- `created_at`
- `updated_at`

说明：

- `title` 默认可由创建预览自动生成，但创建与编辑流程都应允许用户填写或覆盖名称。
- `last_scheduled_at` 是补偿执行判断的核心锚点。

### `automation_triggers`

建议字段：

- `id`
- `automation_id`
- `type`
- `cron_expression`
- `timezone`
- `is_active`
- `created_at`
- `updated_at`

说明：

- 首期只允许 `type = schedule`。
- `timezone` 默认跟随应用当前时区；后续可演进为用户可配。
- 未来邮件等触发器可以新增各自配置字段或扩展子表，而不需要改写 `automations` 的主体语义。

### `automation_runs`

建议字段：

- `id`
- `automation_id`
- `scheduled_for`
- `triggered_at`
- `run_kind`
  - `scheduled`
  - `catch_up`
- `status`
  - `running`
  - `completed`
  - `failed`
- `session_id`
- `error_message`
- `created_at`
- `updated_at`

说明：

- `scheduled_for` 用来标记这次运行对应的计划时间点。
- `run_kind` 区分正常触发和补偿触发。
- `session_id` 用于关联由自动化创建或使用的会话。

## Scheduling Strategy

### Decision

使用 `node-cron` 作为唯一运行时定时调度器，并使用标准 cron 表达式。

### Why

- 满足用户明确约束，不使用自定义内存定时器。
- 调度职责清晰，主进程内可以统一注册和注销任务。

### Registration

- 应用启动时加载所有 `enabled` 且 `trigger_type = schedule` 的自动化。
- 每条自动化在主进程中注册一个 `node-cron` 任务。
- 创建、更新、删除、启停自动化时，调度注册必须同步增删改。

### Catch-up Execution

补偿执行规则：

- 应用启动后，对每条启用中的定时自动化重新计算自 `last_scheduled_at` 之后到“当前时间”为止所有应触发的计划点。
- 如果没有漏跑，则仅注册后续 cron 任务。
- 如果存在多次漏跑，只选择最后一个计划点执行一次补偿任务。
- 补偿任务写入 `automation_runs`，并将 `run_kind` 标记为 `catch_up`。
- 补偿执行完成后，再继续正常 cron 调度。

这样可以满足“如果多次未执行，只执行最后一次”的要求，同时避免重放过期任务造成噪音。

### Concurrency Rule

- 同一条自动化在已有运行中的情况下，不得并发启动第二次执行。
- 若补偿检查时发现上一轮仍处于 `running`，本轮跳过并记录日志。

## Automation Execution Flow

1. 触发器命中计划点。
2. AutomationService 校验自动化、工作空间和触发器仍然有效。
3. 创建 `automation_runs` 记录，写入 `scheduled_for` 与 `run_kind`。
4. 为该工作空间创建或复用自动化专用会话策略。
   - 具体是“始终创建新会话”还是“复用固定会话”，在实现阶段需在不偏离本规范的前提下选一个明确策略。
   - 推荐默认“每次触发创建新会话”，便于隔离执行上下文。
5. 将自动化 `prompt` 作为用户输入发送给 AI。
6. 记录会话关联、运行状态和完成结果。

## UI Design

### UI Contract

- 自动化页面、空状态、列表项和创建 / 编辑弹窗必须遵守仓库根 `DESIGN.md`。
- 本 change 的 UI 需求描述负责定义自动化场景下“要出现什么信息、要完成什么操作”。
- 仓库根 `DESIGN.md` 负责定义“这些信息如何组织成 Willow 的默认视觉与组件表达”。
- 如果实现过程中发现自动化场景与 `DESIGN.md` 冲突，先以本 change 的功能行为约束为准，再回到 `workflow-spec` 判断是否需要补充或修订项目级设计标准。

因此，自动化 UI 在实现时必须至少满足以下项目级风格要求：

- 页面头部保持标题、简短说明和右上角单一主操作的稳定骨架。
- 列表与空状态优先使用 `Card`、轻边框和克制阴影建立层次，不得做成 marketing 风格 landing section。
- 表单和预览内容保持紧凑、可扫描，避免大段说明文案和过度装饰。
- 同一视图内不得出现多个竞争性的主按钮；危险操作必须与普通操作拉开层级。

## Page Layout

- 路由沿用已有 `/auto` 页面入口。
- 页面顶部显示标题与说明。
- 右上角显示“添加自动化”按钮。
- 列表为空时，展示空状态说明和主操作按钮，引导用户创建第一条自动化。
- 列表为空时，在空状态说明下方展示一组中文示例模板卡片，作为辅助创建入口。
- 列表非空时，每一项展示：
  - 自动化标题
  - 关联工作空间
  - 触发器类型与 cron 摘要
  - 提示词摘要
  - 启用状态
  - 最近一次运行信息

## Schedule Input Model

创建 / 编辑弹窗中的定时配置统一分为两层：

1. 前端输入模式
   - `daily_at`
   - `hourly`
   - `weekly_at`
   - `custom`
2. 持久化与调度层
   - 统一保存为标准 cron 表达式

说明：

- `daily_at` 允许用户设置每天的执行时间。
- `hourly` 表示每小时触发一次，首期固定转换为标准 cron 表达式，不额外暴露分钟偏移配置。
- `weekly_at` 允许用户选择一个或多个星期与执行时间。
- `custom` 直接输入标准 cron 表达式。
- 不论前端使用哪种模式，提交到主进程时都必须携带最终标准 cron 表达式，确保调度与补偿计算只依赖一种语义。

## Create Flow

- 点击“添加自动化”打开基于 shadcn-vue 的弹窗。
- 点击空状态示例模板卡片也会打开同一创建弹窗，并按模板预填字段。
- 弹窗字段至少包含：
  - 名称输入框（可选，默认展示自动生成标题并允许覆盖）
  - 工作空间选择器
  - 计划方式选择器
  - 与计划方式对应的时间输入控件
  - AI 输入提示词文本域
- 当计划方式为 `custom` 时，展示 cron 表达式输入框。
- 当计划方式为 `daily_at` 时，展示每日执行时间输入。
- 当计划方式为 `hourly` 时，展示“每小时执行一次”的只读摘要。
- 当计划方式为 `weekly_at` 时，展示星期多选与执行时间输入。
- 弹窗内实时生成“预览卡片”，用于展示：
  - 将在哪个工作空间执行
  - 使用的触发器摘要
  - 对应生成的 cron 表达式
  - 提示词摘要
  - 自动生成标题或用户自定义名称
- 用户确认后创建自动化并返回列表页。

## Template Preset Interaction

- 示例模板只在空状态显示，列表非空后隐藏。
- 每个模板包含：标题、简短说明、图标与一组预填参数。
- 预填参数至少覆盖：
  - prompt
  - schedule mode
  - schedule details（dailyTime / weeklyTime / weeklyDays / customCronExpression）
  - 最终 cron expression
- 创建弹窗初始化优先级：
  1. 编辑态 automation 数据
  2. 模板 preset 数据
  3. 表单默认值

## Validation Rules

- 前端必须在表单内校验快捷计划方式的必填项是否完整。
- 前端在 `custom` 模式下必须校验 cron 表达式是否合法，并给出可理解的错误提示。
- 前端生成的 cron 摘要必须与最终提交的 cron 表达式一致。
- 主进程与 AI tools 仍只以标准 cron 表达式作为最终校验与持久化输入，避免前后端各自维护不同调度语义。

## Suggested shadcn-vue Components

- `Button`
- `Card`
- `Dialog`
- `Input`
- `Textarea`
- `Select`
- `Badge`
- `Table` 或基于 `Card` 的列表容器
- `Empty state` 组合可由 `Card` + `Button` + 文案组成

这些组件的默认使用方式应遵守仓库根 `DESIGN.md` 中的 component recipes，尤其是：

- `Button` 的主次层级
- `Card` / `Separator` 建立结构的方式
- `Dialog` 中标题、说明、表单主体和底部操作区的稳定顺序
- `Badge` 的克制使用和列表扫描性

## AI Tools Design

自动化 tools 首期提供五类能力：

- `automation_list`
- `automation_get`
- `automation_create`
- `automation_update`
- `automation_delete`

工具输入输出要求：

- 使用结构化参数，不暴露底层数据库细节。
- `automation_create` 与 `automation_update` 都必须校验：
  - `workspaceId` 是否存在
  - `trigger.type` 是否受支持
  - `trigger.cronExpression` 是否是合法标准 cron
- 工具返回中应包含自动化基础信息、触发器信息和用户可读摘要，便于 AI 在对话中确认结果。

## Risks And Mitigations

### Risk: 标准 cron 校验和漏跑计算不一致

Mitigation：
- 使用统一的 cron 语义来源做校验与计划点计算，避免“能保存但不能调度”。

### Risk: 关闭应用后遗漏任务过多

Mitigation：
- 明确只补最后一个计划点，避免启动时连续触发历史任务。

### Risk: 自动化执行与普通会话争用资源

Mitigation：
- 通过单自动化互斥执行和运行记录，减少重复触发。

### Risk: 未来触发器扩展导致表结构推翻

Mitigation：
- 独立 `automation_triggers` 与 `automation_runs`，避免把首期定时逻辑硬编码进主体表。
