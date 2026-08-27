import { isExpectedToolPath, isSensitiveToolWrite } from "./directory-access.js";
import { canonicalMutationPath, isWorkspaceMutation, resolveFromCwd } from "./policy.js";
import type {
  PermissionMode,
  ToolApprovalHandler,
  ToolApprovalRequest,
  ToolName,
  ToolRuntimeOptions,
} from "./types.js";

export {
  canonicalMutationPath,
  isPathInside,
  isWorkspaceMutation,
  resolveFromCwd,
} from "./policy.js";

/**
 * 记录每个解析后绝对路径当前排队中的最后一个写操作。
 *
 * 队列只在当前 Willow 进程内生效，用于避免并发的 `write`、`edit` 或计划文件操作
 * 相互覆盖；它不是跨进程文件锁，也不提供文件系统事务能力。
 */
const mutationQueues = new Map<string, Promise<void>>();

/**
 * 统计文本包含的逻辑行数。
 *
 * 空字符串视为 0 行；支持 LF、CRLF 和 CR 三种换行符。若文本以换行符结尾，
 * 末尾由分隔产生的空字符串不计为额外一行。
 */
export function countLines(content: string): number {
  if (content === "") return 0;
  const lines = content.split(/\r\n|\n|\r/);
  return lines.length - (lines[lines.length - 1] === "" ? 1 : 0);
}

/**
 * 执行一次通用工具权限审批。
 *
 * `full-access` 模式直接放行；其他模式必须由审批回调明确返回 `allow`。
 * 未提供回调、回调返回拒绝或无效结果时均按拒绝处理。审批前后都检查中止信号，
 * 避免任务在等待审批期间被取消后仍继续执行。
 *
 * @throws 操作已中止或审批未通过时抛出错误。
 */
export async function authorize(
  mode: PermissionMode,
  requestApproval: ToolApprovalHandler | undefined,
  request: ToolApprovalRequest,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw new Error("Operation aborted");
  if (mode === "full-access") return;
  const decision = requestApproval
    ? await requestApproval({ ...request, permissionMode: mode }, signal)
    : "deny";
  if (signal?.aborted) throw new Error("Operation aborted");
  if (decision !== "allow") throw new Error(`Permission denied for ${request.toolName}`);
}

/**
 * 校验 `write` 或 `edit` 的目标是否具备写权限。
 *
 * 非完全访问模式下按以下顺序判断：
 * 1. 敏感目标（如 `.env`、私钥或策略中的 `denyWrite`）直接拒绝，不允许审批放行；
 * 2. 工作区、系统临时目录、全局技能目录及显式 `allowWrite` 根目录内直接放行；
 * 3. 其他目标发起一次 `outside-workspace-write` 审批。
 *
 * 路径边界由 policy 模块按 canonical path 判断，因此 `..`、符号链接和不存在目标的
 * 最近现存父目录都不会绕过授权。此函数必须在创建目录、读取待编辑文件或写入前调用，
 * 以保证审批被拒绝时不产生目标文件副作用。
 */
export async function authorizeMutation(options: {
  /** 当前工具调用的工作目录，也是相对路径和工作区边界的基准。 */
  cwd: string;
  /** 用户传入的目标路径，可以是绝对路径或相对 `cwd` 的路径。 */
  path: string;
  /** 当前工具调用 ID，用于将审批限制在单次调用内。 */
  toolCallId: string;
  /** 发起写入的文件工具名称。 */
  toolName: Extract<ToolName, "write" | "edit">;
  /** 原始工具输入，随审批请求传递以便展示和审计。 */
  input: Record<string, unknown>;
  /** Bash 快照和未提供动态 provider 时使用的兼容权限模式。 */
  permissionMode: PermissionMode;
  /** Agent 数据目录；其 `skills` 子目录属于允许的全局技能目录。 */
  agentDir?: ToolRuntimeOptions["agentDir"];
  /** 非完全访问模式下用于处理一次性审批的回调。 */
  requestApproval?: ToolApprovalHandler;
  /** 用于在授权过程中响应任务取消。 */
  signal?: AbortSignal;
  /** 额外的读写允许根目录和敏感写入拒绝规则。 */
  sandboxPolicy?: ToolRuntimeOptions["sandboxPolicy"];
  /** 动态读取当前会话的权限等级。 */
  getPermissionMode?: ToolRuntimeOptions["getPermissionMode"];
}): Promise<void> {
  const permissionMode = options.getPermissionMode?.() ?? options.permissionMode;
  // 完全访问模式跳过 Willow 的路径边界和敏感写入策略，但仍受操作系统权限约束。
  if (permissionMode === "full-access") return;

  // 敏感写入属于不可审批的硬限制，必须早于所有允许根目录判断。
  if (await isSensitiveToolWrite(options)) {
    throw new Error(`Sensitive write denied for ${options.path}`);
  }

  if (await isExpectedToolPath({ ...options, access: "write" })) {
    return;
  }

  // 越界批准仅用于当前 toolCallId；这里不会持久化或扩大任何允许根目录。
  await authorize(
    permissionMode,
    options.requestApproval,
    {
      toolCallId: options.toolCallId,
      toolName: options.toolName,
      input: options.input,
      reason: "outside-workspace-write",
      display: options.path,
    },
    options.signal,
  );
}

/**
 * 校验只读文件工具的目标或搜索根是否具备读取权限。
 *
 * 工作区、系统临时目录、全局技能目录、显式 `allowRead` 与 `allowWrite` 根目录内
 * 可直接读取。`allowWrite` 同时隐含读取权限，以支持编辑前读取、元数据检查和写后验证。
 * 其他路径需要当前工具调用的一次性 `outside-workspace-read` 审批。
 *
 * 所有边界均按 canonical path 判断，符号链接逃逸和不存在路径不能绕过检查。
 */
export async function authorizeRead(options: {
  /** 当前工具调用的工作目录，也是相对路径和工作区边界的基准。 */
  cwd: string;
  /** 待读取的文件、目录或搜索根路径。 */
  path: string;
  /** 当前工具调用 ID，用于将审批限制在单次调用内。 */
  toolCallId: string;
  /** 发起读取的文件工具名称。 */
  toolName: Extract<ToolName, "read" | "ls" | "grep" | "find">;
  /** 原始工具输入，随审批请求传递以便展示和审计。 */
  input: Record<string, unknown>;
  /** Bash 快照和未提供动态 provider 时使用的兼容权限模式。 */
  permissionMode: PermissionMode;
  /** Agent 数据目录；其 `skills` 子目录属于允许的全局技能目录。 */
  agentDir?: ToolRuntimeOptions["agentDir"];
  /** 非完全访问模式下用于处理一次性审批的回调。 */
  requestApproval?: ToolApprovalHandler;
  /** 额外的读取或写入允许根目录。 */
  sandboxPolicy?: ToolRuntimeOptions["sandboxPolicy"];
  /** 用于在授权过程中响应任务取消。 */
  signal?: AbortSignal;
  /** 动态读取当前会话的权限等级。 */
  getPermissionMode?: ToolRuntimeOptions["getPermissionMode"];
}): Promise<void> {
  const permissionMode = options.getPermissionMode?.() ?? options.permissionMode;
  // 完全访问模式跳过 Willow 的读取边界，但仍受操作系统权限约束。
  if (permissionMode === "full-access") return;

  if (await isExpectedToolPath({ ...options, access: "read" })) {
    return;
  }

  // 未命中允许根目录时，只申请当前 toolCallId 的一次性越界读取权限。
  await authorize(
    permissionMode,
    options.requestApproval,
    {
      toolCallId: options.toolCallId,
      toolName: options.toolName,
      input: options.input,
      reason: "outside-workspace-read",
      display: options.path,
    },
    options.signal,
  );
}

/**
 * 将同一目标路径的异步修改操作按调用顺序串行执行。
 *
 * 不同路径互不阻塞。即使操作抛错，也会在 `finally` 中释放后继任务；当当前节点仍是
 * 该路径的队尾时会删除映射，避免已完成队列长期驻留。队列直接以字符串作为键，调用方应传入
 * 由统一规则解析出的绝对路径；这里本身不解析符号链接，也不判断两个路径是否指向同一文件。
 */
export async function withMutationQueue<T>(path: string, operation: () => Promise<T>): Promise<T> {
  // `previous` 表示当前操作必须等待的前一个队尾；首次修改无需等待实际工作。
  const previous = mutationQueues.get(path) ?? Promise.resolve();
  let release!: () => void;

  // `current` 由本次操作结束时主动释放，供后继操作等待。
  const current = new Promise<void>((resolvePromise) => {
    release = resolvePromise;
  });

  // 新队尾先等待旧队尾，再等待本次操作释放，从而形成每个路径独立的 Promise 链。
  const tail = previous.then(() => current);
  mutationQueues.set(path, tail);

  await previous;
  try {
    return await operation();
  } finally {
    // 成功、失败或中止都必须放行后继操作，避免队列永久阻塞。
    release();
    // 仅队尾自身负责清理；若已有后继加入，则由最后一个操作完成后清理。
    if (mutationQueues.get(path) === tail) mutationQueues.delete(path);
  }
}

/**
 * 在工具执行的显式检查点响应任务中止。
 *
 * 文件与搜索 API 并非都能在调用途中取消，因此调用方应在耗时操作或副作用前后重复调用。
 *
 * @throws `signal` 已中止时抛出统一的操作中止错误。
 */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("Operation aborted");
}
