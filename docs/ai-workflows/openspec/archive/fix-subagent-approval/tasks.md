# 任务列表：修复子 Agent 权限审批点击无效问题

## 1. 修改后端服务逻辑

- [ ] 修改 `app/work/src/main/service/session.service.ts` 中的 `resolveToolApproval` 方法。
- [ ] 实现 `while (true)` 委派链遍历，确定叶子节点的 `targetSessionId`。
- [ ] 从 `this.runningSessions` 中获取 `targetSessionId` 的 `runningSession`。
- [ ] 调用并执行 `runningSession.coreAgent.resolveToolApproval`，如未找到则抛出错误。

## 2. 校验与验证

- [ ] 执行 `pnpm build` 或 `pnpm lint` 校验代码规范和编译状态。
- [ ] 进行手动功能测试，确保主会话界面的审批操作直接生效。
