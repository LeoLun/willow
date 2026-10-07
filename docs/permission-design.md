# Willow 工具权限设计

本文是 Willow 内建工具权限链路的权威说明。项目内容不能放宽这里的内建规则。

## 1. 统一链路

每次工具调用都依次经过：

```text
Tool Call → 参数校验 → ApprovalAction 归一化 → Permission Engine
          → ALLOW / REVIEW / DENY → PermissionMode 路由 → Executor
          → Bash 非 full-access 额外进入 OS Sandbox
```

`PermissionDecision.action` 描述当前 Action 的结论：

- `allow`：直接进入执行器；
- `review`：按本次调用开始权限检查时捕获的模式路由；
- `deny`：立即失败，任何模式都不能覆盖。

公开模式保持三档：

```ts
type PermissionMode = "request-approval" | "delegate-approval" | "full-access";
```

- `request-approval`：`review` 进入人工单次审批；
- `delegate-approval`：仅 `autoReviewable !== false` 的请求先交 AI Reviewer，未批准、失败或超时回退人工；
- `full-access`：自动接受 `review`，但仍执行参数校验和 Permission Engine，不能绕过 `deny`。

Core 在权限检查开始时只读取一次当前模式，并把该快照同时用于审批路由和 Bash 执行配置，避免调用中途切换造成 TOCTOU。缺少人工 handler 时安全拒绝。无人值守会话只能自动处理可交给 Reviewer 的请求；需要人工的请求安全失败。

每个 Harness 创建独立的 `PermissionEngine`、`EscalationStore` 和可选 `PermissionEventSink`。未注册策略的工具 fail closed。事件 sink 发出判断、审批、沙箱和执行结果结构化事件；一期不写独立 JSONL。

## 2. Action 与审批契约

所有工具输入归一化为 `exec`、`filesystem`、`network`、`automation` 、`mcp` 或 `internal` Action。`ToolApprovalRequest` 同时携带 Action、风险等级、规则 ID、结构化理由、`autoReviewable` 和最小权限范围，并保留 `reason`、`display`、`input` 以恢复旧会话。

审批只对当前 `toolCallId` 和当前 Action 有效。Work 主进程创建、深拷贝并冻结审批 payload，renderer 只能回传不可预测的 `approvalId` 与 `allow/deny`，不能回传或修改 workspace、session、命令或权限范围。审批 FIFO 展示并写入 session branch；停止任务以拒绝结算，未决项可在重启后恢复。旧 reason 继续兼容显示。

## 3. 内建策略

| 工具 | 内建结论 |
| --- | --- |
| `read/ls/grep/find` | 授权根内 `allow`；普通越界 `review`；凭证目录、`.env*`、`*.pem`、`*.key` 等敏感读取 `deny` |
| `write/edit` | 工作区、附件授权区、临时目录和技能授权区内 `allow`；普通越界 `review`；敏感文件、Git hooks/config 和 shell rc `deny` |
| `bash` | hard-deny 优先；已知只读/构建/测试命令 `allow`；安装、删除、Git 写入和未知命令 `review` |
| `create/update/deleteAutomation` | `review`，可由 Reviewer 自动审批 |
| `webfetch/websearch` | 默认 `allow`；初始请求和每次重定向仍执行 denied-domain hard deny |
| `mcpSearch/mcpDescribe` | 显式 `allow`，可连接已配置的全局及项目有效服务；不启动禁用的服务 |
| `mcpCall` | `review`，不信任 `readOnlyHint`，审批绑定工具调用、参数和配置指纹；Plan 模式不注册 |
| `todoList/askUser/listAutomations` | 显式 `allow` |
| 受固定计划路径约束的计划工具 | 显式 `allow` |
| `memory_update` | 独立 filesystem write 策略；固定全局/可信工作区记忆文件 `allow`，非法目标 `deny`；Plan 模式不注册 |

文件路径相对工作区解析，并用最近存在父目录与 `realpath` 得到 canonical path。边界判断必须覆盖不存在目标、`..`、符号链接逃逸和相邻前缀目录。工作区、经主进程验证的附件范围、系统临时目录、全局/内置技能授权区及显式 `SandboxPolicy` 构成允许根；写权限隐含读取权限。Plan 模式只给附件读取授权。

敏感规则是 hard deny，`full-access` 也不能覆盖。`SandboxPolicy` 和未来的项目策略不能放宽内建 hard deny。

## 4. Bash 分析与执行

`BashToolInput` 包含固定工作区 `command`、最长 600 秒的 `timeout`、兼容的 `interactive`，以及：

```ts
sandboxPermissions?: "default" | "elevated";
justification?: string; // 最长 1000 字符
escalationToken?: string;
```

Command Analyzer 不尝试完整解析 shell，只提取命令片段、管道、重定向、替换、sudo、敏感资源、包安装、Git 写入和破坏性行为。复合命令只有全部片段都是已知安全命令，且没有重定向或命令替换时才能 `allow`。sudo、凭证访问、根目录破坏、系统磁盘和关机操作等确定性规则直接 `deny`。

`full-access` 在 Permission Engine 允许后直接使用 shell。其他模式使用 `@anthropic-ai/sandbox-runtime@0.0.73` 的 `workspace-write`：

- 工作区、附件写授权区、系统临时目录和技能授权区可写；其他位置只读或不可访问；
- SSH、云凭证目录、环境文件和密钥不可读写；Git hooks/config 与 shell 启动文件不可写；
- Apple Events、PTY、危险 Unix socket 和本地监听默认关闭；
- 主 Agent 网络使用非 strict allowlist，未匹配宿主默认允许，但 `deniedDomains` 优先拒绝；
- 继承环境会移除常见 API key、云凭证、token、secret 和 password 变量；
- stdout/stderr 流式合并，保留截断日志、超时和进程组终止语义。

runtime Manager 是进程级状态，Core 用全局异步互斥串行完成 initialize、wrap、execute、reset。依赖检测、初始化、包装或 reset 失败统一返回 `SANDBOX_UNAVAILABLE`；非 full-access 绝不回退裸 shell。

## 5. 沙箱提权

沙箱拒绝不会在同一工具调用内自动重跑：

1. 返回 `SANDBOX_DENIED`、结构化 violation 和五分钟一次性 token；
2. token 绑定 Harness/session、原命令、canonical cwd 和 violation；
3. Agent 必须用完全相同命令、`elevated`、token 和非空 justification 发起新调用；
4. hard deny 仍先执行；合法 token 产生 `autoReviewable: false` 的 escalation `review`；
5. 仅人工“仅本次允许”可执行一次 full-access；批准、拒绝或执行失败后能力都失效；
6. 过期、复用、跨 session/cwd、命令变化或参数缺失都拒绝。

token 在显示人工审批前即验证并消费，验证后的 violation 随不可变审批记录持久化，以便未决审批重启恢复；恢复只重建该条已验证的单次能力。

## 6. 验证要求

权限改动至少覆盖：

- 所有 `ToolName` 有策略、unknown-tool fail closed、hard deny 优先和三档路由矩阵；
- canonical 路径、附件/临时/技能授权、不存在目标、symlink escape 与敏感文件；
- Bash analyzer、拒绝时不 spawn、超时/中止/非零/截断和环境变量清理；
- workspace-write 的工作区写、外部写拒绝、`/tmp`、敏感读取、网络及子进程绕过攻击；
- escalation 的正确、过期、复用、命令/cwd/session 不匹配、人工拒绝和只执行一次；
- Work 的 Reviewer 路由、unattended fail closed、IPC 防伪、FIFO、停止与重启恢复；
- Vue 面板的风险、规则、justification、violation 和历史 reason 展示。

常用命令：

```sh
pnpm --filter @willow/core test
pnpm --filter @willow/core typecheck
pnpm --filter Willow test
pnpm --filter Willow typecheck
pnpm lint
pnpm format:check
```

macOS 还应运行真实 Seatbelt smoke/attack tests，并用仓库内 Electron 开发客户端手动验证三档模式。

## 7. 后续范围

一期不加载 repository-owned 权限配置，也不覆盖 Subagent。独立 JSONL 脱敏审计、指标、Reviewer 低权限调查工具与独立沙箱、策略存储、缓存和拒绝效果识别留后续阶段。


## 8. MCP 服务边界

MCP 全局服务由共享运行时持有，项目服务由项目运行时持有；组合目录由项目同名配置覆盖全局配置，
包括禁用项。全局连接、凭据和缓存共享，删除项目不清理全局资源。工具代理通过 Harness 独立的 PermissionEngine 和单次审批执行。
`mcp` Action 包含服务名、原始工具名、参数与绑定来源的配置指纹；全局/项目来源变化也使旧审批失效。
执行前及连接完成后再次核对有效服务来源，防止覆盖关系变化后执行旧审批。服务更新后旧审批不得执行；恢复审批也必须
核对这些字段。`request-approval`、`delegate-approval`、`full-access` 保持现有路由，缺少回调安全拒绝。
Plan 模式只提供目录搜索与工具描述。工具的 `readOnlyHint` 不作为权限依据。

项目中配置的 MCP 服务默认信任，不维护独立服务信任状态，也不需要确认信任。
连接、登录、目录发现与工具调用均不读取信任记录。保存配置不自动启动服务，禁用服务仍拒绝连接和调用。
`mcpCall` 保留会话权限审批和配置指纹校验，配置变化使旧调用审批失效。
本地 stdio 通过无 shell 的进程启动，采用 SDK 的最小环境及显式环境变量，
不继承任意宿主密钥，不执行配置中的动态密钥命令。stdio 服务运行在主机上，
**不进入 Bash OS Sandbox**，因此工具调用审批不能限制服务本身在后台的文件或网络行为。

HTTP 服务使用通用 `url`、可选 `type` 和 `headers` 配置，不需要自定义 `auth` 开关。
未提供 Authorization 请求头时使用 OAuth 凭据并处理服务的认证响应。
工具发现、描述或调用遇到需要认证时通过主进程请求渲染端弹出登录引导，
用户点击「去登录」后发起浏览器登录，等待授权后继续连接；关闭引导、停止任务或移除服务取消待完成的授权。
同一服务的并发工具请求共用一次登录，任务停止取消待完成的授权。状态读取和保存配置不发起登录。HTTP 服务拒绝重定向和跨 origin 凭证转发，
仅明确不支持 Streamable HTTP 时回退 SSE；显式 `type: "sse"` 直接使用 SSE。
状态读取不启动服务、不登录；缓存目录不计为已连接。调用不会在断线后自动重放，停止任务取消
其请求，项目删除和应用退出清理 transport 与进程。

全局 `userData/mcp.json` 和项目 `.mcp.json` 保存配置及 `${willow:...}` 密钥引用。Work 使用本机
`app.getPath("userData")/willow.db` 的 `mcp_credentials` SQLite 表保存 AES-256-GCM 加密凭证，
包括 Bearer Token、OAuth access/refresh token、客户端密钥和敏感环境变量/headers。
加密密钥沿用 `userData/credential.key`，不使用系统钥匙串。密文 envelope 绑定作用域、项目（全局为 null）与存储 key；
key 包含全局或 canonical 项目路径派生的命名空间、服务名和配置指纹，OAuth 凭证额外绑定 issuer。
Renderer 只能写入/替换/删除密钥或读取保存状态，不能读回明文。现有文件中的明文值只在用户显式
转存或保存配置时改为 SQLite 加密存储。注销删除认证 Token，保留独立配置密钥；删除服务或项目
清理相关凭证与缓存，删除项目不删除磁盘项目文件。

## 9. 长期记忆边界

Core 每次 `before_agent_start` 重新加载全局 `~/.willow/memory/MEMORY.md` 与可信工作区
`<workspace>/.willow/memory/MEMORY.md`，作为参考资料注入。当前指令和会话上下文优先于记忆，项目记忆优先于全局。
Core 的 `projectTrusted` 默认为 false；Work 将用户已添加的工作区视为可信，不维护额外信任记录。
未可信工作区不读取项目记忆及项目配置，也不允许项目更新。

`memory_update` 通过 ToolBase、filesystem Action 与 Harness-local PermissionEngine，三档模式均只允许
固定 scope 文件更新。拒绝记忆目录/文件符号链接、文件硬链接、敏感目录和 Git 元数据，执行前再次验证目标。
此能力不向普通文件工具或 Bash sandbox 添加全局记忆目录授权。未注册策略继续 fail closed。
Plan 模式只 recall，不注册记忆写工具；停用记忆不注入内容且不注册工具，执行时重新检查配置。

每个 scope 默认 16 KiB，写入检查 UTF-8 字节数；超限拒绝，读取超限文件仅返回诊断而不注入内容。
更新串行化到 canonical 文件路径，通过唯一临时文件、fsync/close 和 rename 原子替换。
替换限指定章节的唯一精确文本，不存在或歧义时失败；不允许更新改变章节边界。

设置页读取和原生打开 IPC 仅接受 scope 和项目 workspaceId；主进程查询已保存的工作区并解析固定路径，拒绝额外字段。
设置页保存 IPC 额外接受 content 和 expectedContent（不存在的文件为 null），不接受任意路径。显式用户编辑通过 core 的固定路径校验、容量检查及原子写入保存；按目标路径串行校验旧内容，发生并发更新时拒绝覆盖。用户可编辑已停用的记忆，但非法配置会拒绝保存。
读取和进入编辑模式不创建文件；点击保存才写入内容。原生打开接口仍只在明确打开时创建默认文件。
本版不在 turn_end 提取记忆，不新增退出提取或 compact 长期记忆写入。

记忆总开关 IPC 仅接受 enabled 布尔值，通过 core 校验全局固定 config.json 路径并原子保存，保留容量和未知配置字段。全局关闭不能被项目配置覆盖；新请求不注册 memory_update、不注入记忆。
