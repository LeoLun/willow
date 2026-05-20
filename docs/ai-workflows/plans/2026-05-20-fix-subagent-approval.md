# 2026-05-20-fix-subagent-approval.md

## 执行切片 1: 修改主进程 SessionService 的审批路由

### 目标

在主进程服务 `SessionService` 中，当解析工具审批时，能自动追踪会话的委派链路，并定位到当前最深层活跃的叶子会话。

### 影响文件

- [app/work/src/main/service/session.service.ts](file:///Users/liujinglun/code/willow/app/work/src/main/service/session.service.ts)

### 修改点

在 `resolveToolApproval` 方法中：
1. 使用 `while (true)` 结构沿 `this.delegatedSessionRuns` 映射表追踪子会话。
2. 寻找到不再有委派子会话的终端叶子 `targetSessionId`。
3. 从 `this.runningSessions` 中获取对应的 `runningSession` 实例。
4. 调用 `runningSession.coreAgent.resolveToolApproval` 执行解析。

### 校验命令

```bash
pnpm lint
pnpm build
```

---

## 执行切片 2: 功能验证与测试

### 验证步骤

1. 启动 Electron 桌面应用：
   ```bash
   pnpm dev
   ```
2. 在项目会话中发出指令触发子 Agent 执行（例如使用 subagent 运行带文件写入或读取的任务）。
3. 子 Agent 弹出权限申请面板。
4. 在当前主会话的页面底部审批面板中点击“确认”或“拒绝”按钮。
5. 验证子会话是否收到审批结果并继续执行，主界面不再阻塞。
