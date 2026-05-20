# 子 Agent 审批规格说明书

## 需求

### R1: 委派会话下的工具审批自动下发和向下寻址

- 当主会话 A 委派子会话 B 运行时，主进程中的 `SessionService` 必须能够自动将 B 的待审批（pending）权限显示至 A 页面上（已由 `forwardApprovalsToParentSessionId` 和 `upsertToolApproval` 实现）。
- 当用户在 A 的 `PermissionApprovalPanel` 点击批准/拒绝时，主进程必须根据 A 到 B 的委派关系（`delegatedSessionRuns`），将决策正确路由至 B 会话的执行实例。

### R2: 委派链的多级支持 (Multilevel Delegation Support)

- 寻址算法必须支持多级委派（例如 A -> B -> C）。
- 在任意一级会话的界面中触发审批解析时，都必须沿着委派链找到最末端正在执行的子会话，并解析其工具调用审批。

## 验收标准

- [ ] 在主 Agent 对话界面（主会话）执行子 Agent 任务。
- [ ] 子 Agent 执行需要权限审批的工具调用（例如写入文件），主 Agent 界面底部出现审批面板。
- [ ] 在主 Agent 对话界面点击“允许”或“拒绝”按钮。
- [ ] 工具调用审批被正确解析，子 Agent 恢复执行或得到对应的错误反馈。
- [ ] 构建无任何 TypeScript 编译错误。
