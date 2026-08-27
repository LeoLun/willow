import {
  isSensitiveWritePath,
  isWorkspaceMutation,
  pathMatchesAllowedRoot,
  resolveGlobalSkillsDirectory,
} from "./policy.js";
import { systemTemporaryDirectories } from "./temporary-directories.js";
import type { SandboxPolicy } from "./types.js";

export type DirectoryAccess = "read" | "write";

/**
 * 判断文件工具的目标是否位于当前工作区或宿主授予的副作用空间内。
 *
 * 所有比较都通过 policy 模块解析 canonical path，因此不存在目标、`..` 和符号链接逃逸
 * 不能绕过边界。写权限隐含读取权限；只读授权不能用于写入。
 */
export async function isExpectedToolPath(options: {
  cwd: string;
  path: string;
  access: DirectoryAccess;
  agentDir?: string;
  sandboxPolicy?: SandboxPolicy;
}): Promise<boolean> {
  const { cwd, path, access, agentDir, sandboxPolicy } = options;
  if (access === "write" && (await isSensitiveWritePath(cwd, path, sandboxPolicy))) {
    return false;
  }

  const globalSkillsDirectory = resolveGlobalSkillsDirectory(agentDir);
  const commonRoots = [
    ...systemTemporaryDirectories(),
    ...(globalSkillsDirectory ? [globalSkillsDirectory] : []),
  ];
  if (await isWorkspaceMutation(cwd, path)) return true;
  if (await pathMatchesAllowedRoot(cwd, path, commonRoots)) return true;

  const allowedRoots =
    access === "read"
      ? [...(sandboxPolicy?.allowRead ?? []), ...(sandboxPolicy?.allowWrite ?? [])]
      : (sandboxPolicy?.allowWrite ?? []);
  return await pathMatchesAllowedRoot(cwd, path, allowedRoots);
}

export async function isSensitiveToolWrite(options: {
  cwd: string;
  path: string;
  sandboxPolicy?: SandboxPolicy;
}): Promise<boolean> {
  return await isSensitiveWritePath(options.cwd, options.path, options.sandboxPolicy);
}
