## Why

当前工具实现以各自独立导出为主，工具定义字段、执行约定与权限边界分散在不同文件中，已经开始影响后续扩展和一致性维护。现在需要在继续增加工具能力之前，先收敛统一的 tool 创建方式，并补上完整的权限审批链路，避免高风险工具在没有明确用户决策的情况下直接执行。

## What Changes

- 新增统一的 `createTool` 工厂约定，用于声明工具名称、展示信息、参数模式、执行逻辑以及权限元数据，替代当前分散的工具定义模式。
- 为工具执行增加统一权限控制层，其中真正低风险的工具如 `ls`、`read`、`webfetch`、`websearch` 默认直接放行，具体风险判断可由工具内部自行决定；高风险操作以 `bash` 工具为重点，命中高危命令时必须先进行人工确认，且首版只支持单次批准/拒绝。
- 将 `bash` 工具的权限控制细化为“按操作风险判断”，而不是对全部 `bash` 调用一刀切审批。
- 改造前端 tool 展示与交互组件，在工具触发权限审批时向用户展示必要上下文，并允许用户做出批准或拒绝决策。
- 调整工具注册与运行时数据结构，使后端/前端都能识别权限状态、审批结果和执行进度。

## Capabilities

### New Capabilities

- `tool-definition-contract`: 统一工具定义与注册契约，覆盖 `createTool` 工厂、工具元数据声明和运行时接入方式。
- `tool-permission-control`: 为工具执行提供统一权限判断、审批请求与决策结果应用机制。
- `bash-high-risk-approval`: 为 `bash` 工具定义高危命令识别与人工确认机制。
- `tool-approval-ui`: 在前端展示待审批工具调用，并支持用户批准、拒绝和查看相关上下文。

### Modified Capabilities

无

## Impact

- `packages/core/src/tools/` 下的工具定义、注册与执行流程
- 可能涉及 `packages/core/src/core-agent.ts` 及相关运行时消息结构
- `app/work/src/main/` 中会话、事件分发或工具执行桥接逻辑
- `app/work/src/renderer/` 与 `packages/ui/` 中的 tool 展示组件和用户审批交互
