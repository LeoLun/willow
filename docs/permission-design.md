# Willow 工具权限设计

本文描述当前工具权限边界。核心原则是：文件工具使用统一的 canonical 路径授权，权限等级
按会话动态读取，Bash 直接执行命令且不参与审批。

## 1. 权限等级

公开等级保持不变：

```ts
type PermissionMode = "request-approval" | "delegate-approval" | "full-access";
```

- `request-approval`：越界调用执行前请求用户单次批准。
- `delegate-approval`：先交给审批代理；代理拒绝、失败、超时或无法判断时回退用户审批。
- `full-access`：跳过 Willow 的路径边界，但不绕过操作系统权限。

Work 主进程的 `PermissionModeService` 以 `workspaceId + sessionId` 保存当前等级，缺省为
`request-approval`。renderer 通过独立 IPC 串行同步工作区、会话和下拉选择变化，并在发送消息前
等待同步完成。`SendMessageRequest` 和消息队列不携带权限等级。

Core 的 `PermissionModeProvider` 在每次非 Bash 文件权限检查发生时读取最新等级。切换只影响尚未
开始检查的调用，不结算或撤销已经开始、已经执行或正在等待决定的调用。自动化后台会话在发送前
通过同一服务初始化为 `delegate-approval`。

`permissionMode` 静态字段仍是兼容默认值，也是未提供动态 provider 时非 Bash 文件工具的默认等级。
Bash 不参与审批。

## 2. 统一目录授权

`read`、`write`、`edit`、`ls`、`grep`、`find` 共用目录授权器。目标路径先相对工作区解析，再以
最近存在的父目录和 `realpath` 计算 canonical 路径，最后用路径包含关系判断边界。这同时阻止
`..`、现有符号链接和不存在目标经符号链接父目录逃逸。

非完全访问模式的免审批读取范围：

- 当前 canonical 工作区；
- 当前会话分支中经主进程验证的附件副作用空间；
- `SandboxPolicy.allowRead` 与 `allowWrite`；
- 系统临时目录；
- `agentDir` 下的全局技能目录；
- Core 注入的内置技能只读目录。

非完全访问模式的免审批写入范围：

- 当前 canonical 工作区；
- 附件中明确授权写入的副作用空间；
- `SandboxPolicy.allowWrite`；
- 系统临时目录；
- 全局技能目录及明确配置为可写的技能目录。

附件文件只授权精确文件，附件目录递归授权。授权不扩展到父目录、兄弟路径，也不允许目录内的
符号链接逃逸。Plan 模式只把附件授权放入 `allowRead`，且不注册通用写工具。

`.env`、`.env.*`、`*.pem`、`*.key` 和 `denyWrite` 命中的敏感写入，在非完全访问模式下硬拒绝，
不会弹审批。只有最新等级为 `full-access` 时绕过该应用层限制。

其余路径统一产生 `outside-workspace-read` 或 `outside-workspace-write` 审批。批准只对当前
`toolCallId` 有效；缺少 handler、拒绝、无效结果或中止都安全失败，且写工具必须在创建父目录、
读取待编辑文件或写入前完成授权。

## 3. Bash 边界

`bash` 在所有权限模式下直接执行命令：

- 恒以 `/bin/bash -lc <command>` 运行，不进入沙箱，也不触发任何审批；
- 因此 `permissionMode` 与 `sandboxPolicy` 不影响 `bash` 的执行；
- 受操作系统自身权限约束，本工具不做应用层路径或网络域的限制。

## 4. 免审批工具

以下工具不进入权限审批：

| 工具 | 保留的安全或业务约束 |
| --- | --- |
| `webfetch` | URL/协议校验、HTTPS 升级、每一跳 `deniedDomains`、超时、5MB、重定向上限和中止 |
| `websearch` | 固定 Tavily 接口、密钥保护、参数校验、`deniedDomains`、超时和中止 |
| `todoList` | 参数校验和当前 Harness 内状态 |
| `askUser` | 独立用户问题事件与中止处理 |
| `listAutomations` | 工作区隔离和宿主查询约束 |
| `createAutomation` | 参数校验、工作区归属、宿主持久化和调度约束 |
| `updateAutomation` | 参数校验、归属复核、运行冲突和宿主更新约束 |
| `deleteAutomation` | 参数校验、归属复核、运行冲突和宿主删除约束 |

“免审批”只移除权限等级分支，不移除硬拒绝、输入验证、超时、中止或宿主业务错误。特别是
`webfetch` 的初始请求和每次重定向都检查拒绝域名；`full-access` 也不绕过该拒绝列表。

## 5. 工具集合与历史兼容

默认模式注册 Bash、六个文件工具、todo、web、askUser 和四个自动化工具；Plan 模式只注册只读
文件工具、web、askUser 与计划文件工具。`websearch` 仅在配置 Tavily Key 时注册。

宿主进程列表工具已经从实现、工厂、注册、公共类型、提示词和桌面展示中移除。为避免旧会话加载
失败，历史审批 reason（包括 `process-inspection`、沙箱相关 reason 和旧自动化 reason）仍可解析
和展示。恢复规则：

- 旧审批被拒绝时，不执行旧调用；
- 旧 web/自动化审批被允许时，按当前免审批实现重放；
- 旧宿主进程列表审批被允许时，以“工具已移除”错误结果继续会话。

## 6. 审批生命周期

Core 只调用 `requestApproval(request, signal)`，不实现 UI 或代理判断。Work 在每次回调发生时读取
最新会话等级：`full-access` 直接允许，`delegate-approval` 走审批代理并按现有规则回退用户，
`request-approval` 进入用户审批队列。

审批按 `workspaceId + sessionId + toolCallId` 隔离并 FIFO 展示；决定仅结算匹配项。停止任务会中止
等待并以拒绝结算。未决审批写入 session branch，重启后可恢复；允许恢复时用新的 Harness 重放
单个工具调用，拒绝时直接生成错误结果，然后继续 agent 会话。

## 7. 测试要求

权限变更至少覆盖：

- bash 直接执行：输出、退出码、超时、中止与截断；
- 工作区、附件文件、附件目录、临时目录、全局/内置技能、额外读写根和读写差异；
- 不存在目标、`..` 与符号链接逃逸；
- 敏感写入和 `full-access` 绕过；
- 六个文件工具的一致判定、单次审批、缺失 handler、拒绝和中止；
- 连续调用间动态切换三种等级；
- web 与自动化工具在三种等级下均不调用审批，同时保留拒绝列表和业务错误；
- 会话默认值、隔离、IPC 参数校验、快速切换顺序、发送前同步和自动化初始化；
- 工具注册、导出、提示和展示不再含已移除工具，以及历史未决审批迁移。

Core 测试使用 `pnpm --filter @willow/core test`。
