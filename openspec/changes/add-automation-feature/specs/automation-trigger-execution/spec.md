## ADDED Requirements

### Requirement: The system SHALL support an extensible trigger model for automations
系统必须将自动化触发方式建模为可扩展的触发器类型与配置，而不是只支持不可扩展的单一定时实现，从而为未来邮件等触发器预留扩展空间。

#### Scenario: Saving a scheduled trigger
- **WHEN** 用户创建一条使用定时任务触发的自动化
- **THEN** 系统会以触发器类型加触发器配置的形式保存该自动化，并在定时配置中保存标准 cron 表达式

### Requirement: Scheduled automations SHALL use node-cron with standard cron expressions
系统必须使用 `node-cron` 实现定时任务调度，并要求定时触发配置使用标准 cron 表达式，而不是自定义内存定时器规则。

#### Scenario: Scheduling an automation with node-cron
- **WHEN** 一条启用中的定时自动化被加载到调度系统
- **THEN** 系统会基于其 cron 表达式通过 `node-cron` 注册对应任务

#### Scenario: Rejecting an invalid cron expression
- **WHEN** 用户提交不符合标准 cron 格式的定时表达式
- **THEN** 系统会拒绝保存该自动化，并提示用户修正表达式

#### Scenario: Converting preset schedule modes into cron expressions
- **WHEN** 用户在表单中选择“每天”“每小时”或“每周”这类预设模式
- **THEN** 系统会在保存前将其确定性转换为标准 cron 表达式，并以该表达式作为调度依据

#### Scenario: Restoring a preset mode from a saved cron expression
- **WHEN** 用户编辑一条已有自动化且其 cron 表达式符合已支持的预设模式
- **THEN** 系统会优先将该表达式回填为对应的预设模式和表单值；若不符合，则回填为“自定义”

#### Scenario: Preserving trigger extensibility
- **WHEN** 系统读取一条自动化记录
- **THEN** 该记录中的触发方式会以可区分类型和配置的结构表示，而不是依赖只适用于定时任务的固定字段语义

### Requirement: The system SHALL execute scheduled automations while the process is running
系统必须在应用进程存活期间根据已启用自动化的定时配置触发执行，并将执行调度与自动化记录保持同步。

#### Scenario: Running an enabled scheduled automation
- **WHEN** 一条启用中的定时自动化到达计划执行时间
- **THEN** 系统会自动触发该自动化对应的执行流程

#### Scenario: Ignoring disabled automations
- **WHEN** 一条自动化处于停用状态
- **THEN** 系统不会为其注册或触发执行计划

### Requirement: Automation execution SHALL support both new-session and fixed-session modes
系统必须支持自动化在执行时选择“每次创建新会话”或“复用固定会话”两种模式，以满足隔离执行和连续上下文两类场景。

#### Scenario: Executing in new-session mode
- **WHEN** 一条自动化配置为“创建新会话”
- **THEN** 每次自动化触发时系统都会创建一个新的会话并在该会话中执行提示词

#### Scenario: Executing in fixed-session mode
- **WHEN** 一条自动化配置为“复用固定会话”
- **THEN** 系统会在首次执行时建立绑定会话，并在后续触发时继续向该会话追加执行内容

### Requirement: Missed scheduled executions SHALL compensate only the latest missed time
系统必须在应用进程关闭后重新启动时检查错过的定时执行，并且如果存在多次遗漏，只补执行最近一次错过的计划时间，忽略更早遗漏。

#### Scenario: Compensating one missed execution after restart
- **WHEN** 应用重新启动且某条启用中的自动化错过了一次计划时间
- **THEN** 系统会在恢复阶段补执行这一次错过的计划任务

#### Scenario: Compensating multiple missed executions after restart
- **WHEN** 应用重新启动且某条启用中的自动化在停机期间错过了多次计划时间
- **THEN** 系统只会补执行最近一次错过的计划时间，而不会回放更早的遗漏时间点

### Requirement: The system SHALL retain the latest execution outcome for each automation
系统必须保存每条自动化最近一次执行的计划时间、实际执行时间、执行结果和失败摘要，以支持列表页展示与补偿判断。

#### Scenario: Recording a successful automation run
- **WHEN** 一条自动化执行成功
- **THEN** 系统会更新该自动化最近一次执行的时间和成功状态

#### Scenario: Recording a failed automation run
- **WHEN** 一条自动化执行失败
- **THEN** 系统会更新该自动化最近一次执行的失败状态，并保留可用于排查的错误摘要
