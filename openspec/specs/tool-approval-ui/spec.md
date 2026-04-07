## ADDED Requirements

### Requirement: The UI SHALL present actionable approval requests for tools
系统必须将待审批的工具调用渲染为明确可操作的审批卡片或等价交互 UI，其中至少包含工具标识、参数摘要和可执行的决策动作。

#### Scenario: Showing a pending approval
- **WHEN** renderer 收到某个工具调用的待审批状态
- **THEN** 聊天界面必须展示清晰可见的审批交互，并明确提示该工具正在等待用户操作

#### Scenario: Showing a high-risk bash approval
- **WHEN** renderer 收到 `bash` 工具的高危命令审批请求
- **THEN** 聊天界面必须展示待执行命令摘要和“这是高危操作，需要人工确认”的提示信息

### Requirement: The UI SHALL let users approve or reject a tool call
系统必须为每个待审批请求提供单次批准和单次拒绝操作控件，并将用户决策直接发送回执行层，而不要求用户手动输入命令。

#### Scenario: Approving from the tool component
- **WHEN** 用户在工具审批 UI 中点击批准操作
- **THEN** renderer 会把批准结果发送到主进程，并使该工具调用离开待审批状态

#### Scenario: Rejecting from the tool component
- **WHEN** 用户在工具审批 UI 中点击拒绝操作
- **THEN** renderer 会把拒绝结果发送到主进程，并使该工具调用离开待审批状态

#### Scenario: No persistent approval options are shown
- **WHEN** 用户看到工具审批 UI
- **THEN** 界面中不会出现“本次会话始终允许”或其他持久化授权选项

### Requirement: The UI SHALL show resolved approval outcomes
系统必须在审批完成后展示该工具调用最终是被批准还是被拒绝，让用户能够理解该工具为什么执行或为什么没有执行。

#### Scenario: Rendering a resolved approval result
- **WHEN** 一个待审批请求被处理完成
- **THEN** 对应的工具组件会更新为展示最终审批结果以及该工具调用的状态
