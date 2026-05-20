# 修复子 Agent 权限审批点击无效问题

## 动机

在对话页面（主 Agent 会话）中执行子 Agent 时，如果子 Agent 触发了工具调用权限申请（例如读取或写入文件等敏感操作），主 Agent 页面底部会显示 `PermissionApprovalPanel` 审批面板。然而，用户在主 Agent 界面点击“允许”或“拒绝”按钮时操作无效。用户必须手动切换到该子 Agent 独立的会话页面，在其中点击审批才能生效。这降低了用户体验，打断了正常的工作流。

## 目标

1. 在主 Agent 界面点击子 Agent 触发的权限审批时，能够成功通过/拒绝该审批并恢复子 Agent 的执行。
2. 保持子 Agent 独立页面中点击审批生效的既有行为。
3. 代码改动最小化，且不引入架构副作用。

## 范围

- 调整主进程中的 `SessionService.resolveToolApproval` 逻辑。
- 当传入的 `sessionId` 对应会话有正在委派执行的子会话（通过 `delegatedSessionRuns` 关联）时，顺着委派链条递归寻找到最底层的子会话，并对其执行审批解析。

## 非范围

- 不改变前端 `PermissionApprovalPanel` 组件的结构与交互方式。
- 不影响主 Agent 自身的权限审批流程。
