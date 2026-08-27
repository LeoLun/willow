# Core 工具实现说明

实现位于 `packages/core/src/tools/`，注册与公共导出位于 `tools/index.ts`。权限语义以
[`permission-design.md`](./permission-design.md) 为准。

## 运行时入口

`ToolBase.execute()` 统一执行 schema/语义校验、Action 归一化、Harness-local
`PermissionEngine` 判断、模式路由、审批、执行与结构化事件。模式在一次调用开始权限检查时捕获，
本次调用后续不再读取动态 provider。所有内建 `ToolName` 必须有明确策略，未知策略拒绝。

路径逻辑集中在 `directory-access.ts` 与 `policy.ts`：相对工作区解析，从最近存在父目录计算 canonical
path，并用路径段包含关系处理不存在目标、`..` 和符号链接逃逸。文件工具执行器不再各自实现审批。

## Bash

`permission-engine.ts` 的 Command Analyzer 只提取有限风险事实，不完整解析 shell。确定性 hard deny
先于任何审批；已知安全命令允许；有副作用或无法分类的命令进入 review。

`bash.ts` 保留流式合并输出、2000 行/50KB 截断、完整临时日志、超时、AbortSignal 和进程组终止。
`full-access` 经策略允许后直接执行；其他模式通过 `sandbox-runtime.ts` 在 `workspace-write` 中执行。
沙箱 Manager 的 initialize/wrap/execute/reset 由全局异步互斥串行化，任何 runtime 失败都 fail closed。

沙箱 denial 生成五分钟 token。`escalation-store.ts` 把它绑定到 session、命令和 canonical cwd；合法
elevated 重试在审批展示前消费 token，并产生不可交给 AI Reviewer 的单次 full-access review。

## Work 集成

Work 主进程依据本次捕获的模式处理 review：request 进入人工，delegate 先 AI 后人工，full-access
由 Core 自动接受。主进程深拷贝并冻结审批 payload，持久化到 session branch；renderer 只回传
`approvalId + decision`。恢复 elevated 审批时只从已持久化的原 Action 和 violation 重建已验证的一次性
能力。

## 验证

重点测试包括：

- `permission-engine.test.ts`：策略覆盖、hard deny、命令分析和模式矩阵；
- `escalation-store.test.ts`：绑定、过期、复用和 human-only elevated；
- `tools.test.ts`：路径、文件工具、Bash 输出/退出/超时/中止/截断；
- `webfetch.test.ts`、`websearch.test.ts`：网络 hard deny、重定向、超时与中止；
- 自动化、Work 审批服务、恢复、IPC 和 Vue 面板测试；
- 支持平台上的真实 sandbox smoke/attack tests。
