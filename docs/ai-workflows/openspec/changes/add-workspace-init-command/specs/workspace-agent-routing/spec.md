# workspace-agent-routing Specification

## ADDED Requirements

### Requirement: Conversation Must Discover Workspace Agents From AGENTS.md Frontmatter

系统 MUST 在对话作用域中把项目工作空间视为可调用的工作空间 Agent，其元信息来源于工作空间根目录 `AGENTS.md` 顶部 YAML frontmatter。

#### Scenario: Load workspace agent metadata from AGENTS.md frontmatter

- **前提** 系统中存在一个项目工作空间
- **并且** 该工作空间根目录存在 `AGENTS.md`
- **并且** 该文件以 YAML frontmatter 开头，包含 `name` 与 `description`
- **当** 对话作用域准备加载可用工作空间 Agent
- **那么** 系统读取该文件 frontmatter 中的 `name` 与 `description`
- **并且** 将其作为工作空间 Agent 的展示与调度元信息

#### Scenario: Ignore workspace agents without required frontmatter

- **前提** 某个项目工作空间存在 `AGENTS.md`
- **并且** 该文件缺少 YAML frontmatter、`name` 或 `description`
- **当** 对话作用域构建工作空间 Agent 列表
- **那么** 系统不得把该工作空间作为可自动路由的子 Agent
- **并且** 可以向用户提示先执行 `/init` 或补全 `AGENTS.md`

#### Scenario: Treat Chinese body fields as migration hints only

- **前提** 某个项目工作空间的 `AGENTS.md` 正文中包含中文“名称”或“描述”
- **并且** 该文件缺少有效的 frontmatter `name` 或 `description`
- **当** 对话作用域构建工作空间 Agent 列表
- **那么** 系统可以把这些正文内容用于提示 `/init` 改进文件
- **并且** 不得仅凭正文中文字段把该工作空间标记为可自动调度

### Requirement: Conversation Must Treat Workspace Agents As Child Agents

系统 MUST 将对话作用域建模为主 Agent，并允许其按需调用工作空间子 Agent 执行任务。

#### Scenario: Delegate matched work to a workspace child agent

- **前提** 对话作用域已加载一个或多个工作空间 Agent 的 `name` 与 `description`
- **当** 用户请求明显匹配某个工作空间 Agent 的职责范围
- **那么** 对话主 Agent 可以调用该工作空间子 Agent 执行任务
- **并且** 子 Agent 在对应工作空间路径下工作
- **并且** 最终结果回流给对话主 Agent 再返回给用户

#### Scenario: Keep work on the main agent when no workspace matches

- **前提** 对话作用域已加载工作空间 Agent 列表
- **当** 用户请求不明显属于任何工作空间 Agent 的职责范围
- **那么** 对话主 Agent 可以直接处理该请求
- **并且** 系统不得为了形式上的多 Agent 化而强制委派

### Requirement: Workspace Delegation Must Use Independent Child Agent Sessions

系统 MUST 以真正独立的子 Agent 会话执行工作空间委派，而不是仅通过切换主 Agent 的工作目录、技能上下文或 prompt 字段来模拟。

#### Scenario: Create an independent child agent session for delegation

- **前提** 对话主 Agent 已决定把本轮任务委派给某个工作空间 Agent
- **当** 系统开始执行该次委派
- **那么** 系统创建一个独立的子 Agent 运行实例
- **并且** 该子 Agent 在目标工作空间路径下构建自己的系统上下文
- **并且** 该子 Agent 使用该工作空间的 `AGENTS.md` 与技能集

#### Scenario: Do not satisfy delegation by only switching the main agent cwd

- **前提** 对话主 Agent 已决定委派给某个工作空间 Agent
- **当** 系统执行该次委派
- **那么** 系统不得只把主 Agent 的 `cwd`、系统 prompt 或技能列表改成目标工作空间后继续执行
- **并且** 必须存在独立于主 Agent 的子 Agent 会话边界

#### Scenario: Child agent returns structured results to the main agent

- **前提** 某个工作空间子 Agent 已完成本轮任务
- **当** 系统准备把结果返回给用户
- **那么** 子 Agent 先把结果回传给对话主 Agent
- **并且** 对话主 Agent 基于该结果向用户生成最终答复
- **并且** 用户不需要直接消费未经整理的完整子 Agent 原始历史

#### Scenario: Only final results flow back to the main agent

- **前提** 某个工作空间子 Agent 在执行过程中调用了工具、经历了审批或产生了中间过程消息
- **当** 系统把该次委派结果回传给对话主 Agent
- **那么** 回传内容只包含最终执行结果、失败原因或停止结论
- **并且** 不包含子 Agent 的中间工具调用明细
- **并且** 不包含审批过程细节或逐步过程消息

#### Scenario: Stop and failure propagate across orchestration boundary

- **前提** 某个工作空间子 Agent 正在执行任务
- **当** 用户停止当前对话轮次或子 Agent 执行失败
- **那么** 系统能够中断或结束该子 Agent
- **并且** 对话主 Agent 收到明确的停止或失败结果
- **并且** 不会出现主 Agent 已结束但子 Agent 仍在后台失控运行的状态

### Requirement: Workspace Delegation Must Be Represented As A Tool Invocation

系统 MUST 将对话页对子 Agent 的工作空间委派表现为一次独立的 tool 调用，而不是仅作为普通文本或隐式内部状态。

#### Scenario: Render workspace delegation as a tool call

- **前提** 对话主 Agent 决定把本轮任务委派给某个工作空间子 Agent
- **当** 系统开始执行该次委派
- **那么** 消息流中出现一条独立的工作空间委派 tool 调用记录
- **并且** 该记录展示目标工作空间名称与 Agent 名称
- **并且** 该记录拥有独立的进行中 / 完成 / 失败状态

#### Scenario: Tool result carries child session identity

- **前提** 某次工作空间委派已经创建了独立子 Agent 会话
- **当** 系统生成该次委派的 tool 结果
- **那么** 结果中包含子 Agent 会话 ID
- **并且** 包含目标工作空间 ID 或等价导航信息
- **并且** 包含结果摘要或失败原因

#### Scenario: Tool result omits child tool details from the main conversation

- **前提** 某个工作空间子 Agent 在本轮任务中发生了多个工具调用
- **当** 系统在主会话中渲染该次工作空间委派的 tool 结果
- **那么** 该结果只展示最终摘要、失败原因或停止结论
- **并且** 不展开子 Agent 内部工具调用列表
- **并且** 用户如需查看过程细节，应进入对应的子 Agent 会话

#### Scenario: Click tool UI to navigate to child session

- **前提** 用户正在查看一条已渲染的工作空间委派 tool 卡片
- **并且** 该卡片已经关联了独立子 Agent 会话
- **当** 用户点击“查看子会话”或等价入口
- **那么** 系统跳转到该子 Agent 对应的会话页面
- **并且** 用户可以查看该子 Agent 自己的完整消息和运行历史

#### Scenario: Do not reduce delegation to plain assistant text

- **前提** 对话主 Agent 已经触发一次工作空间委派
- **当** 消息流向用户展示本轮过程
- **那么** 系统不得只用普通 assistant 文本描述“已调用某个工作空间”
- **并且** 必须有独立的 tool UI 表达这次委派行为

### Requirement: Conversation UI Must Allow Explicit Workspace Agent Selection With Slash

系统 MUST 允许用户在对话界面中通过 `/` 显式指定某个工作空间子 Agent。

#### Scenario: Show workspace agents in conversation slash picker

- **前提** 用户当前处于对话作用域
- **并且** 系统存在可用的工作空间 Agent
- **当** 用户打开 slash 资源选择器
- **那么** 系统展示工作空间 Agent 结果项
- **并且** 每项至少显示 frontmatter `name`
- **并且** 每项显示 frontmatter `description` 或工作空间名称作为辅助信息
- **并且** 结果项与 skill 结果使用相近的信息结构，让用户能像发现 skill 一样发现工作空间 Agent

#### Scenario: Send explicit workspace agent selection as structured data

- **前提** 用户在对话界面中通过 slash 选择了某个工作空间 Agent
- **当** 用户发送当前消息
- **那么** renderer 以结构化字段发送该工作空间 Agent 标识
- **并且** 主进程将其视为本轮显式委派目标
- **并且** 不依赖从正文字符串反向解析

#### Scenario: Explicit selection overrides automatic routing

- **前提** 用户在本轮消息中显式指定了某个工作空间 Agent
- **当** 对话主 Agent 准备决定是否委派
- **那么** 系统优先使用用户显式指定的工作空间 Agent
- **并且** 不再为本轮重新选择其他工作空间 Agent
