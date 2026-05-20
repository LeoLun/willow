# 设计文档：修复子 Agent 权限审批点击无效问题

## 架构决策

### 1. 递归向下解析委派链条的审批

目前的主进程 `SessionService.resolveToolApproval` 逻辑如下：
```typescript
  async resolveToolApproval(
    sessionId: number,
    toolCallId: string,
    decision: ToolApprovalDecision,
    reason?: string,
  ): Promise<void> {
    let runningSession = this.runningSessions.get(sessionId);

    // If not a direct running session, check if this is a parent delegating to a child
    if (!runningSession) {
      const delegatedRun = this.delegatedSessionRuns.get(sessionId);
      if (delegatedRun) {
        runningSession = this.runningSessions.get(delegatedRun.childSessionId);
      }
    }
    // ...
  }
```

当主 Agent 在前台运行时，主 Agent 自身的会话 `sessionId` 依然存在于 `this.runningSessions` 中（主 Agent 正在阻塞等待 `runWorkspaceDelegate` 工具调用返回结果）。
因此，`runningSession = this.runningSessions.get(sessionId)` 不为空，这导致代码**不会**进入 `if (!runningSession)` 分支，进而不会去查找 `delegatedSessionRuns` 中它所委派的子会话。
之后，代码尝试在主 Agent 的 `coreAgent` 上解析 `toolCallId`，由于该 `toolCallId` 属于子 Agent 而非主 Agent，解析失败并抛出 "tool approval not found" 异常。

### 决策

我们应该**始终**沿着委派链条递归寻找到当前活跃的最底层（叶子）子会话 ID，然后在该子会话的 `runningSession` 上解析工具审批。
由于主 Agent 在委派子 Agent 时是阻塞式等待的，它自身不会产生并行的待审批工具调用，因此沿着委派链条找到最底层的子会话是完全安全且唯一的。

### 委派链寻址逻辑

```typescript
    let targetSessionId = sessionId;
    while (true) {
      const delegatedRun = this.delegatedSessionRuns.get(targetSessionId);
      if (delegatedRun) {
        targetSessionId = delegatedRun.childSessionId;
      } else {
        break;
      }
    }
```
通过上述循环，如果会话 A 委派了 B，B 委派了 C：
- 输入 `sessionId = A` 时，`targetSessionId` 会被更新为 B，再更新为 C。
- 在 `this.runningSessions.get(C)` 获取到对应的 `runningSession` 并在此执行解析。
- 这同样适用于直接在 B 页面或 C 页面点击审批的场景（如果直接在 C 页面点击，`delegatedSessionRuns` 中找不到 C 的 Key，`targetSessionId` 保持为 C，正确解析）。

## 数据流

```
主 Agent 界面点击审批 (Session A)
  ↓
IPC RESOLVE_TOOL_APPROVAL (sessionId = A, toolCallId = X)
  ↓
SessionService.resolveToolApproval(A, X)
  ↓ 遍历委派链
发现 A 委派了 B 运行 -> targetSessionId 更新为 B
  ↓
获取 runningSessions.get(B)
  ↓
调用 B.coreAgent.resolveToolApproval(X)
  ↓
成功解析，子 Agent B 继续运行
```
