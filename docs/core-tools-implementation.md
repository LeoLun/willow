# Core 内置工具实现说明

## 1. 文档定位

本文说明 `packages/core/src/tools/` 中七个内置工具的注册方式、执行流程、输出结构、中止语义和
权限检查实现。

权限模型的规范性定义仍以
[`permission-design.md`](./permission-design.md) 为准。本文更侧重从代码实现角度解释一次工具
调用如何从 `AgentHarness` 到达具体工具，以及每个工具内部实际执行了哪些步骤。

当前内置工具包括：

- `bash`：执行 shell 命令；
- `read`：读取 UTF-8 文本文件；
- `write`：创建或覆盖文件；
- `edit`：通过精确文本替换编辑文件；
- `ls`：列出目录的直接子项；
- `grep`：递归搜索文件内容；
- `find`：按 glob 递归查找文件。

## 2. 工具创建与注册

### 2.1 Agent Harness 创建

`AgentCore.getAgentHarness()` 在创建本次 Agent Harness 时确定权限模式：

```ts
const permissionMode = options.permissionMode ?? "request-approval";
```

未指定模式时默认使用 `request-approval`。随后 Core 将工作区、权限模式和审批回调传给
`createWillowTools()`：

```ts
tools: createWillowTools({
  cwd: this.cwd,
  permissionMode,
  requestApproval: options.requestApproval,
}),
```

权限选择属于当前 Harness，不会由 Core 持久化为工作区或会话级规则。

在非 `full-access` 模式下，Core 依赖 macOS `sandbox-exec`，因此会在非 macOS 平台拒绝创建
Harness。`full-access` 不依赖该沙箱，可以继续创建。

### 2.2 工具集合

`packages/core/src/tools/index.ts` 按以下顺序创建工具：

```ts
[
  createBashTool(options),
  createReadTool(options),
  createWriteTool(options),
  createEditTool(options),
  createLsTool(options),
  createGrepTool(options),
  createFindTool(options),
]
```

每个工具都是 `AgentTool`，包括：

- `name`、`label` 和供模型理解的 `description`；
- 使用 TypeBox 定义的参数 Schema；
- `execute(toolCallId, input, signal, onUpdate?)`；
- 供 Work App 展示和统计的结构化 `details`。

七个内置工具都继承 `ToolBase`。基类的公共 `execute()` 固定按以下顺序编排调用：

1. 检查 `AbortSignal`；
2. 使用工具的 TypeBox Schema 校验输入结构；
3. 调用工具实现的 `checkParams()` 校验数值、正则等语义约束；
4. 调用 `checkPermission()` 完成执行前授权；
5. 调用 `run()` 执行工具逻辑；
6. 通过 `buildResponse()` 构造成功结果。

任一阶段失败时，基类通过 `buildError()` 保留已有 `Error`，或将其他异常值转换为 `Error` 后
重新抛出。`pi-agent-core` 会将抛出的错误转换为 `isError: true` 的工具结果交给 Agent，不会把
失败伪装为成功结果。`bash` 的路径和域名权限只能在沙箱执行后确定，因此它的前置权限钩子为空，
动态拒绝仍通过基类的单次审批辅助方法处理。

`index.ts` 同时公开导出各工具的输入类型、权限类型和结果详情类型。

## 3. 权限公共模型

### 3.1 权限模式

Core 支持三种模式：

```ts
type PermissionMode =
  | "request-approval"
  | "delegate-approval"
  | "full-access";
```

| 模式 | Core 内的行为 |
| --- | --- |
| `request-approval` | `bash` 沙箱优先；具体域名、读路径或写路径越界时调用审批回调 |
| `delegate-approval` | 与 `request-approval` 使用相同执行边界，同样调用审批回调 |
| `full-access` | 跳过 Willow 沙箱和工作区读写检查 |

Core 不负责实现用户审批界面或 AI 代审。`request-approval` 和 `delegate-approval` 在 Core
内部的差异仅体现在传入的模式值；两者遇到逃逸时都调用同一个
`requestApproval(request, signal)` 接口。AI 初审、用户审批和失败降级由 Work App 注入的回调
决定。

### 3.2 审批请求

审批请求结构为：

```ts
type ToolApprovalRequest = {
  toolCallId: string;
  toolName: ToolName;
  input: Record<string, unknown>;
  reason:
    | "outside-workspace-read"
    | "outside-workspace-write"
    | "network-domain"
    | "sandbox-denied";
  display: string;
  mayHavePartialEffects?: boolean;
};
```

字段语义：

| 字段 | 作用 |
| --- | --- |
| `toolCallId` | 将批准绑定到当前一次工具调用 |
| `toolName` | 标识发起请求的工具 |
| `input` | 保留原始工具参数，供审计和界面展示 |
| `reason` | 区分工作区外读取、工作区外写入和网络域名扩权 |
| `display` | 面向用户展示的路径或命令 |
| `mayHavePartialEffects` | 提醒首轮执行可能已经产生部分副作用 |

审批结果只有 `allow` 和 `deny`。Core 不保存批准结果，也不生成永久或会话级白名单。

### 3.3 安全失败

共享 `authorize()` 函数遵循以下规则：

1. Signal 已中止时立即失败；
2. `full-access` 直接返回；
3. 有审批回调时等待回调结果；
4. 没有审批回调时使用 `deny`；
5. 只有严格的 `allow` 才继续执行，其他结果均抛出权限拒绝错误。

因此，缺少 handler、回调返回拒绝、回调异常或等待期间中止都不会隐式放行。

## 4. 写路径授权

`write` 和 `edit` 在非 `full-access` 模式下调用 `authorizeMutation()`。

### 4.1 路径解析

相对路径通过 `resolve(cwd, path)` 基于工作区解析，绝对路径直接规范化。工作区判断不是简单的
字符串前缀比较，而是：

1. 从目标绝对路径开始检查路径是否存在；
2. 对不存在的目标不断向父目录回溯；
3. 找到最近存在的路径；
4. 对最近存在路径调用 `realpath()`，解析符号链接；
5. 将尚不存在的剩余路径重新拼接到 canonical parent；
6. 对工作区本身调用 `realpath()`；
7. 使用 `path.relative()` 判断 canonical target 是否位于 canonical workspace 内。

这一流程可以识别：

- `../` 逃逸；
- 工作区外绝对路径；
- 工作区内符号链接指向外部目录；
- 目标尚不存在、但最近存在父目录位于工作区外的情况。

敏感模式 `.env`、`.env.*`、`*.pem`、`*.key` 在非完全访问模式下硬拒绝，不调用审批。
工作区或显式 `allowWrite` 根内目标直接放行。其他目标产生：

```ts
{
  reason: "outside-workspace-write",
  display: input.path,
}
```

审批发生在创建父目录、读取待编辑文件或写入内容之前。

### 4.2 Mutation Queue

`write` 和 `edit` 使用进程内的：

```ts
Map<string, Promise<void>>
```

为解析后的绝对路径维护 Promise 链。同一路径的修改串行执行，不同路径可以并发。无论操作成功
还是失败，`finally` 都会释放队列中的下一个操作；队尾完成后对应 Map 项会被删除。

该队列不提供：

- 跨 Willow 进程的文件锁；
- 文件事务；
- 失败回滚；
- 对首轮 shell 副作用的保护。

## 5. `bash`

实现文件：`packages/core/src/tools/bash.ts`。

### 5.1 输入

```ts
{
  command: string;
  timeout?: number;
}
```

`timeout` 以秒为单位，必须是正有限数；未提供时不设置默认超时。

### 5.2 沙箱策略

在 `request-approval` 和 `delegate-approval` 模式下，Core 通过
`@carderne/sandbox-runtime` 初始化 macOS Seatbelt 沙箱和受控网络代理。用户主目录默认禁止
读取，再放行 canonical workspace、系统临时目录以及当前调用已批准的路径；写入只允许上述
路径，并叠加敏感文件 deny rules。网络使用域名 allowlist，未允许域名由代理 callback 报告。

`SandboxManager` 是进程级单例，因此 Core 将 runtime 初始化、命令执行、清理和 reset 串行化，
防止多个 Harness 的策略相互覆盖。

`full-access` 模式直接执行：

```text
/bin/bash -lc <command>
```

### 5.3 资源拒绝和沙箱内重跑

Core 不解析 shell AST，也不会预判各个子命令所需权限，而是先在沙箱中运行完整命令。

未允许域名会构造 `network-domain` 审批；shell 重定向输出或 macOS violation monitor
识别出的写路径会构造 `outside-workspace-write` 审批。批准后只将该域名或 canonical path
加入当前工具调用的内存授权，重新初始化 runtime，并在扩展后的沙箱中完整重跑。

未知沙箱拒绝不会再转换为裸跑审批，而是安全失败。每条命令最多允许 16 次资源扩权。

`mayHavePartialEffects` 表示首轮命令可能已经完成工作区内的部分修改。首轮执行与获批后的完整
重跑之间没有事务性，也不保证命令幂等。

### 5.4 进程控制

shell 子进程以 `detached: true` 启动，从而形成独立进程组。超时或 Signal 中止时：

1. 优先向负 PID 发送 `SIGKILL`，终止整个进程组；
2. 如果进程组终止失败，再尝试终止单个 PID；
3. 清理 timeout 和 AbortSignal listener；
4. 以超时或中止错误结束工具调用。

非零退出码且没有被识别为沙箱拒绝时，Core 格式化输出后抛出普通命令错误，不返回成功结果。

### 5.5 输出

stdout 和 stderr 被合并。每次收到数据都会通过 `onUpdate` 发送流式工具更新。

最终结果使用尾部截断：

- 最多 2000 行；
- 最多 50KB。

发生截断时，完整输出写到系统临时目录中的 `output.log`，路径通过 `fullOutputPath` 返回。

`details` 包含：

```ts
{
  kind: "bash";
  command: string;
  exitCode: number;
  lineCount: number;
  sandboxed: boolean;
  truncation?: TruncationResult;
  fullOutputPath?: string;
}
```

## 6. `read`

实现文件：`packages/core/src/tools/read.ts`。

### 6.1 输入

```ts
{
  path: string;
  offset?: number;
  limit?: number;
}
```

`offset` 使用从 1 开始的行号，默认值为 1。`offset` 和已提供的 `limit` 必须是正整数。

### 6.2 执行流程

1. 验证 `offset` 和 `limit`；
2. 对目标 canonical path 执行读取授权；
3. 检查 AbortSignal；
4. 基于工作区解析路径；
5. 以 UTF-8 读取完整文件；
6. 再次检查 AbortSignal；
7. 将 CRLF 和 CR 统一为 LF；
8. 按 `offset/limit` 切片；
9. 对结果执行头部 2000 行/50KB 截断。

如果输出被截断，返回文本会提示调用方继续使用 `offset/limit` 分页读取。

工作区、显式 `allowRead` 或 `allowWrite` 根内直接读取；其他目标产生
`outside-workspace-read` 一次性审批。

## 7. `write`

实现文件：`packages/core/src/tools/write.ts`。

### 7.1 输入

```ts
{
  path: string;
  content: string;
}
```

### 7.2 执行流程

1. 在产生文件副作用之前调用 `authorizeMutation()`；
2. 将目标路径解析为绝对路径；
3. 进入该路径的 mutation queue；
4. 检查中止；
5. 递归创建父目录；
6. 再次检查中止；
7. 使用 UTF-8 创建或覆盖文件；
8. 再次检查中止；
9. 计算文本行数和 UTF-8 字节数。

该工具只支持创建或覆盖，不支持追加。

`details` 包含：

```ts
{
  kind: "write";
  path: string;
  lineCount: number;
  byteCount: number;
}
```

## 8. `edit`

实现文件：`packages/core/src/tools/edit.ts`。

### 8.1 输入

```ts
{
  path: string;
  edits: Array<{
    oldText: string;
    newText: string;
  }>;
}
```

`edits` 至少包含一项。

### 8.2 权限与读取时序

`edit` 在读取原文件之前调用 `authorizeMutation()`。工作区外编辑被拒绝时不会先读取文件，也不会
创建或写入目标。

获准后，工具进入目标路径的 mutation queue 并读取 UTF-8 内容。

### 8.3 精确替换约束

每个 replacement 必须满足：

- `oldText` 非空；
- `oldText` 存在于原文件；
- `oldText` 在原文件中只出现一次；
- 多个 replacement 的匹配区间不重叠。

工具先基于原文件计算全部匹配区间，按起始位置排序并检查重叠，再从后向前应用替换。反向替换
避免前面文本长度变化导致后续区间偏移失效。

### 8.4 文本格式保护

工具会：

- 检测并保留 UTF-8 BOM；
- 检测原文件使用 LF、CRLF 还是 CR；
- 在内部统一为 LF 进行匹配和 diff；
- 写回时恢复原文件的换行风格。

替换完成后，工具使用 `diffLines()` 统计增加和删除行数，并通过 `createPatch()` 生成 unified
diff。

`details` 包含：

```ts
{
  kind: "edit";
  path: string;
  addedLines: number;
  removedLines: number;
  diff: string;
}
```

## 9. `ls`

实现文件：`packages/core/src/tools/ls.ts`。

### 9.1 输入

```ts
{
  path?: string;
}
```

未指定路径时使用 `"."`。

### 9.2 执行流程

`ls` 只读取指定目录的直接子项，不递归：

1. 检查 AbortSignal；
2. 基于工作区解析路径；
3. 使用 `readdir(..., { withFileTypes: true })` 读取目录；
4. 再次检查 AbortSignal；
5. 将目录排在文件之前；
6. 同类条目按名称进行 `localeCompare()` 排序；
7. 为目录名追加 `/`。

空目录返回 `(empty directory)`。`ls` 在读取前授权目录，工作区外目录需要一次性审批。

## 10. `grep`

实现文件：`packages/core/src/tools/grep.ts`。

### 10.1 输入

```ts
{
  pattern: string;
  path?: string;
  glob?: string;
  ignoreCase?: boolean;
  literal?: boolean;
  context?: number;
  limit?: number;
}
```

`limit` 默认 100，必须是正整数；`context` 默认 0，必须是非负整数。

### 10.2 正则构造

- `literal` 为假时，`pattern` 直接用于构造 `RegExp`；
- `literal` 为真时，先转义正则特殊字符，再构造字面量正则；
- `ignoreCase` 为真时使用 `i` flag；
- 非法正则由 `RegExp` 构造直接抛错。

### 10.3 搜索流程

1. 通过共享 `resolveSearchFiles()` 获取候选文件；
2. 使用可选 `glob` 过滤文件相对路径；
3. 检查 AbortSignal；
4. 将文件读取为 Buffer；
5. 跳过包含 NUL 字节的二进制文件；
6. 按行执行正则；
7. 每个命中增加 `matchCount`；
8. 将匹配行及前后 `context` 行加入输出集合；
9. 到达 match limit 后停止继续匹配。

同一文件中的上下文行通过 `Set` 去重并按行号排序。输出格式为：

```text
relative/path.ts:12:line content
```

每一行会单独执行行长度截断；整体输出再按 50KB 从头部截断。

`details` 包含匹配数，以及可选的：

- `matchLimitReached`；
- `linesTruncated`；
- `truncation`。

`grep` 在遍历前授权搜索根，工作区外搜索需要一次性审批。

## 11. `find`

实现文件：`packages/core/src/tools/find.ts`。

### 11.1 输入

```ts
{
  pattern: string;
  path?: string;
  limit?: number;
}
```

`limit` 默认 1000，必须是正整数。

### 11.2 执行流程

1. 通过 `resolveSearchFiles()` 枚举候选文件；
2. 使用 minimatch 匹配相对路径；
3. 启用 dot 文件匹配和 `matchBase`；
4. 对匹配路径排序；
5. 截取前 `limit` 项；
6. 将整体输出按 50KB 从头部截断。

`find` 只返回文件，不返回目录。没有结果时返回 `No files found`。

`details` 包含：

- `pattern`；
- `resultCount`；
- 可选 `resultLimitReached`；
- 可选 `truncation`。

`find` 在遍历前授权搜索根，工作区外搜索需要一次性审批。

## 12. `grep/find` 共享文件遍历

实现文件：`packages/core/src/tools/search-files.ts`。

### 12.1 搜索根

- 未指定 `path` 时使用工作区根目录；
- 搜索根是普通文件时，直接返回该文件；
- 搜索根是目录时，递归遍历其中的普通文件。

### 12.2 忽略规则

默认忽略：

- `.git/`；
- `node_modules/`。

遍历器还会读取搜索根目录下的 `.gitignore`。如果用户明确将 `.git` 或 `node_modules` 本身设为
搜索根，则关闭对应的默认跳过规则，允许显式搜索。

`.gitignore` 只影响 `grep/find` 的搜索结果，不是权限边界，也不会阻止 `read` 显式读取文件。

### 12.3 中止

遍历器在进入目录和处理每个目录项之前检查 AbortSignal。已经发出的单次 `readdir()` 或
`readFile()` 不能由该检查直接取消，但会在下一检查点终止后续工作。

## 13. 权限决策矩阵

| 工具或行为 | `request-approval` | `delegate-approval` | `full-access` |
| --- | --- | --- | --- |
| `bash` 可在沙箱完成 | 沙箱执行 | 沙箱执行 | 直接执行 |
| `bash` 请求未允许域名/写路径 | 允许该资源后在沙箱内重跑 | AI 或用户允许后在沙箱内重跑 | 不经过沙箱 |
| `bash` 未知拒绝 | 安全失败 | 安全失败 | 不经过沙箱 |
| `write/edit` 工作区内写入 | 直接执行 | 直接执行 | 直接执行 |
| `write/edit` 工作区外写入 | 写入前调用审批回调 | 写入前调用审批回调 | 直接执行 |
| `write/edit` 敏感路径 | 硬拒绝 | 硬拒绝 | 直接执行 |
| `read/ls/grep/find` 工作区内 | 直接读取 | 直接读取 | 直接读取 |
| `read/ls/grep/find` 工作区外 | 读取前调用审批回调 | 读取前调用审批回调 | 直接读取 |
| 缺少审批回调 | 拒绝需要逃逸的调用 | 拒绝需要逃逸的调用 | 不需要回调 |

## 14. 中止与副作用边界

所有工具都接收可选的 AbortSignal，但中止检查是协作式的：

- `bash` 可以主动终止整个 shell 进程组；
- 文件和搜索工具在显式检查点观察中止；
- Node 已经开始的单次文件系统调用通常不能被同步撤销；
- `write/edit` 在写入完成后才观察到中止时，工具调用可能返回失败，但文件修改已经发生；
- 等待审批期间的中止通过同一个 Signal 传给上层审批回调。

因此，AbortSignal 保证停止后续执行，但不提供文件事务或副作用回滚。

## 15. 实现边界与注意事项

1. 只读工具在非完全访问模式下对工作区外路径要求一次性审批。
2. `delegate-approval` 的 AI 判断不在 Core 内实现，Core 只调用注入的审批 handler。
3. 所有授权都是单次授权，不存在永久或隐式白名单。
4. `bash` 获批后只放行具体域名或路径，但仍会在沙箱中重跑完整命令。
5. 沙箱拒绝依赖输出文本启发式识别，未覆盖的新系统错误文案会表现为普通命令失败。
6. 首轮沙箱执行与扩权后沙箱重跑之间没有事务性，命令调用方不能假设它们是原子的。
7. `full-access` 只绕过 Willow 自身的沙箱和工作区检查，不能绕过操作系统权限、ACL 或系统安全
   策略。
8. 当前沙箱模式只支持 macOS。
9. Mutation queue 只提供单进程、单路径的串行化，不提供跨进程一致性。

## 16. 测试覆盖

主要测试位于 `packages/core/test/tools.test.ts`，当前覆盖：

- `write/read/ls/edit` 的基本执行和结构化 details；
- `edit` 的缺失匹配、非唯一匹配和失败不修改原文件；
- 工作区外读写路径和符号链接逃逸审批；
- 敏感写入硬拒绝及 `full-access` 绕过；
- `bash` 的 `full-access` 直接执行；
- macOS runtime 的安全命令执行；
- 具体域名和写路径获批后的沙箱内重跑；
- 未知拒绝不触发通用审批或非沙箱重跑；
- 沙箱逃逸的拒绝、委托批准、缺失 handler 和 `full-access`；
- `.gitignore`；
- `grep` 二进制文件跳过；
- `find/grep` 的基本结果统计。

资源扩权和未知拒绝回归测试位于
`packages/core/test/bash-sandbox-policy.test.ts`。

工具或权限行为发生变化时，应同步更新本说明、`permission-design.md` 和对应测试。
