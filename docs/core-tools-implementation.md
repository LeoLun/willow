# Core 工具实现说明

实现位于 `packages/core/src/tools/`，注册与公共导出位于 `tools/index.ts`。默认 Harness 提供
`bash`、`read`、`write`、`edit`、`ls`、`grep`、`find`、`todoList`、`webfetch`、可选
`websearch`、`askUser` 及自动化工具；Plan Harness 使用只读工具和计划工具子集。

## 1. 运行时权限接口

```ts
type ToolRuntimeOptions = {
  cwd: string;
  permissionMode: PermissionMode;
  getPermissionMode?: PermissionModeProvider;
  requestApproval?: ToolApprovalHandler;
  sandboxPolicy?: SandboxPolicy;
};
```

六个文件工具在每次授权时调用 `getPermissionMode`，缺少 provider 时回退静态
`permissionMode`。Bash 只使用静态值构建沙箱或直接执行，因此会话运行期间的权限切换不会改变
已有 Bash Harness。

## 2. 文件工具

`directory-access.ts` 是目录授权入口，复用 `policy.ts` 的：

- `resolveFromCwd`：解析绝对目标；
- `canonicalMutationPath`：从最近存在父目录计算目标 canonical 路径；
- `isPathInside`：按路径段判断包含关系；
- `isSensitiveWritePath`：匹配默认及配置的敏感写入规则。

`shared.ts` 的 `authorizeRead` 与 `authorizeMutation` 先读取最新权限等级，再调用统一授权器。
非完全访问模式下，工作区、系统临时目录、全局技能目录和对应 `allowRead`/`allowWrite` 空间直接
执行；其他路径通过 `requestApproval` 请求当前 `toolCallId` 的一次性权限。写权限隐含读取权限，
只读权限不能写入。敏感写入先于允许根检查并硬拒绝。

`write` 和 `edit` 在授权完成前不创建目录、不读取目标、不写文件。写操作通过进程内目标队列串行
执行。`edit` 要求非空、唯一、不重叠的精确替换，并保留 BOM 与换行风格。

`read` 支持 1-based offset/limit；`ls` 只列直接子项；`grep` 和 `find` 共用搜索遍历器，尊重
`.gitignore`，默认跳过 `.git`、`node_modules` 和二进制文件，并维持稳定排序、限制和中止语义。

## 3. Bash

非完全访问模式通过 macOS sandbox runtime 执行完整命令。允许资源来自工作区、临时目录、技能
目录、SandboxPolicy 和当前 Bash 调用批准的具体资源。识别出的网络域名、读写路径、localhost、
PTY 或 Apple Events 能力获批后，只扩展当前调用并在沙箱中重跑。未知拒绝不会变成非沙箱执行。

`full-access` 直接运行 `/bin/bash -lc`。输出合并 stdout/stderr，最多返回 2000 行或 50KB；截断时
完整输出写入临时日志。超时和 AbortSignal 终止进程组。

沙箱中的宿主进程枚举安全失败，错误仅说明当前沙箱不支持进程查看。仓库不再注册独立的宿主进程
列表工具。

## 4. Web 工具

`webfetch` 不调用审批回调。它校验 HTTP/S URL、升级 HTTP、在初始请求和每一跳重定向前检查
`deniedDomains`，并保留超时、AbortSignal、重定向数量、5MB 响应大小及 text/markdown/html
转换。允许域名列表不再作为访问前置条件。

`websearch` 只在存在 Tavily Key 时注册，固定请求 `api.tavily.com`，不按权限等级分支，也不调用
审批回调。显式拒绝 Tavily 域名时三种等级都失败；密钥只进入 Authorization header，不写入工具
结果或错误详情。

## 5. 直接执行工具

`todoList`、`askUser`、`listAutomations`、`createAutomation`、`updateAutomation`、
`deleteAutomation` 不使用权限审批。它们仍执行各自参数校验、工作区归属校验、中止处理及宿主业务
规则。自动化后台 session 由 Work 主进程初始化为 `delegate-approval`，供该会话随后可能发生的
文件工具权限检查使用。

## 6. 审批和恢复

`authorize()` 的结果只有 `allow` 和 `deny`。缺少 handler、无效结果或中止都拒绝。审批不写入
Core 白名单，只对当前调用有效。

Work 恢复旧未决审批时先处理决定：拒绝不执行；允许后从当前 Harness 查找工具并重放。已经改为
免审批的 web/自动化工具因此可以继续执行；已删除的宿主进程列表工具返回明确的“工具已移除”错误。
历史 approval reason 类型继续保留以支持解析和展示。

## 7. 验证

核心回归测试位于 `packages/core/test/`，重点文件包括：

- `tools.test.ts`：统一路径、动态权限、文件工具和 Bash；
- `webfetch.test.ts`、`websearch.test.ts`：网络硬限制、转换、超时与中止；
- `create-automation.test.ts`、`automation-management.test.ts`：自动化直接执行与业务约束；
- `index.test.ts`：工具注册和公共集合；
- `bash-sandbox-policy.test.ts`：真实 macOS 沙箱边界。

公共 API 或跨包变更还应运行全仓 typecheck、lint 和 format check。
