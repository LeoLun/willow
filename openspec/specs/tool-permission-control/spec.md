## ADDED Requirements

### Requirement: Tool execution SHALL support declarative permission policies
系统必须允许每个工具定义声明权限策略，用来表示该工具是可以直接执行，还是必须先经过用户明确批准后才能执行。

#### Scenario: Executing a low-risk tool
- **WHEN** agent 调用一个权限策略被标记为自动允许的工具
- **THEN** 该工具会直接执行，而不会暂停等待用户审批

#### Scenario: Executing an explicitly low-risk core tool
- **WHEN** agent 调用 `ls`、`read`、`webfetch` 或 `websearch` 这类被定义为低风险的核心工具
- **THEN** 权限层不会为该次调用创建审批请求，而是直接放行到工具内部执行

### Requirement: Approval-gated tools SHALL pause before execution
系统必须在工具真正执行前拦截需要审批的工具调用，发布包含工具名称、参数和决策上下文的审批请求事件，并在继续之前等待用户决定。

#### Scenario: Executing a protected tool
- **WHEN** agent 调用一个权限策略要求审批的工具
- **THEN** 该工具调用会先进入暂停状态并发出审批请求，而不是立刻执行

### Requirement: Bash SHALL require confirmation only for high-risk operations
系统必须将 `bash` 工具的审批策略细化为基于命令内容的高危操作识别；只有命中高风险操作的命令才需要人工确认，普通低风险 shell 命令不应被一律拦截。

#### Scenario: Executing a low-risk bash command
- **WHEN** agent 通过 `bash` 调用一个未命中高危规则的普通命令
- **THEN** 该命令可以直接执行，而不会触发人工审批

#### Scenario: Executing a high-risk bash command
- **WHEN** agent 通过 `bash` 调用一个命中高危规则的命令
- **THEN** 权限层必须先发出审批请求，并在用户明确批准前禁止执行该命令

### Requirement: The permission layer SHALL honor explicit user decisions
系统必须根据用户的审批结果恢复或拒绝一个已暂停的工具调用，并且首版只支持针对当前这一次工具调用的单次批准或单次拒绝。

#### Scenario: User approves a paused tool call
- **WHEN** 用户批准一个待处理的审批请求
- **THEN** 被阻塞的工具调用会恢复执行，并使用最初请求的参数运行

#### Scenario: User rejects a paused tool call
- **WHEN** 用户拒绝一个待处理的审批请求
- **THEN** 该工具调用会在不执行工具实现的情况下结束，并向 agent 返回一个可感知的拒绝结果

#### Scenario: Decision does not persist beyond the current tool call
- **WHEN** 用户完成一次批准或拒绝
- **THEN** 该决策只对当前 `toolCallId` 生效，不会自动复用于后续新的工具调用

### Requirement: Permission decisions SHALL be observable in session events
系统必须为“请求审批”“已批准”“已拒绝”这些工具调用状态发出会话可观测事件并持久化状态变化，使主进程和 renderer 都能够反映当前执行状态。

#### Scenario: Syncing approval status to the UI
- **WHEN** 一个工具审批请求被创建或被处理完成
- **THEN** active session stream 中必须包含足够的状态信息，使 renderer 能展示该工具调用的待审批或已完成审批状态
