import {
  canonicalMutationPath,
  isSensitiveWritePath,
  isWorkspaceMutation,
  pathMatchesAllowedRoot,
  resolveGlobalSkillsDirectory,
  resolveFromCwd,
} from "./policy.js";
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

const mutationQueues = new Map<string, Promise<void>>();

export function countLines(content: string): number {
  if (content === "") return 0;
  const lines = content.split(/\r\n|\n|\r/);
  return lines.length - (lines[lines.length - 1] === "" ? 1 : 0);
}

export async function authorize(
  mode: PermissionMode,
  requestApproval: ToolApprovalHandler | undefined,
  request: ToolApprovalRequest,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw new Error("Operation aborted");
  if (mode === "full-access") return;
  const decision = requestApproval ? await requestApproval(request, signal) : "deny";
  if (decision !== "allow") throw new Error(`Permission denied for ${request.toolName}`);
}

export async function authorizeMutation(options: {
  cwd: string;
  path: string;
  toolCallId: string;
  toolName: Extract<ToolName, "write" | "edit">;
  input: Record<string, unknown>;
  permissionMode: PermissionMode;
  agentDir?: ToolRuntimeOptions["agentDir"];
  requestApproval?: ToolApprovalHandler;
  signal?: AbortSignal;
  sandboxPolicy?: ToolRuntimeOptions["sandboxPolicy"];
}): Promise<void> {
  if (options.permissionMode === "full-access") return;
  if (await isSensitiveWritePath(options.cwd, options.path, options.sandboxPolicy)) {
    throw new Error(`Sensitive write denied for ${options.path}`);
  }
  const globalSkillsDirectory = resolveGlobalSkillsDirectory(options.agentDir);
  if (
    (await isWorkspaceMutation(options.cwd, options.path)) ||
    (globalSkillsDirectory !== undefined &&
      (await pathMatchesAllowedRoot(options.cwd, options.path, [globalSkillsDirectory]))) ||
    (await pathMatchesAllowedRoot(options.cwd, options.path, options.sandboxPolicy?.allowWrite))
  ) {
    return;
  }
  await authorize(
    options.permissionMode,
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

export async function authorizeRead(options: {
  cwd: string;
  path: string;
  toolCallId: string;
  toolName: Extract<ToolName, "read" | "ls" | "grep" | "find">;
  input: Record<string, unknown>;
  permissionMode: PermissionMode;
  agentDir?: ToolRuntimeOptions["agentDir"];
  requestApproval?: ToolApprovalHandler;
  sandboxPolicy?: ToolRuntimeOptions["sandboxPolicy"];
  signal?: AbortSignal;
}): Promise<void> {
  if (options.permissionMode === "full-access") return;
  const globalSkillsDirectory = resolveGlobalSkillsDirectory(options.agentDir);
  if (
    (await isWorkspaceMutation(options.cwd, options.path)) ||
    (globalSkillsDirectory !== undefined &&
      (await pathMatchesAllowedRoot(options.cwd, options.path, [globalSkillsDirectory]))) ||
    (await pathMatchesAllowedRoot(options.cwd, options.path, options.sandboxPolicy?.allowRead)) ||
    (await pathMatchesAllowedRoot(options.cwd, options.path, options.sandboxPolicy?.allowWrite))
  ) {
    return;
  }
  await authorize(
    options.permissionMode,
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

export async function withMutationQueue<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const previous = mutationQueues.get(path) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolvePromise) => {
    release = resolvePromise;
  });
  const tail = previous.then(() => current);
  mutationQueues.set(path, tail);

  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (mutationQueues.get(path) === tail) mutationQueues.delete(path);
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("Operation aborted");
}
