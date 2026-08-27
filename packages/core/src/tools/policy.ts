import { lstat, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import minimatch from "minimatch";
import type { SandboxPolicy } from "./types.js";

export const DEFAULT_DENY_WRITE_PATTERNS = [".env", ".env.*", "*.pem", "*.key"] as const;

export function resolveFromCwd(cwd: string, path: string): string {
  return isAbsolute(path) ? resolve(path) : resolve(cwd, path);
}

export function resolveGlobalSkillsDirectory(agentDir: string | undefined): string | undefined {
  if (!agentDir) return undefined;
  const globalAgentDir = isAbsolute(agentDir) ? resolve(agentDir) : resolve(homedir(), agentDir);
  return join(globalAgentDir, "skills");
}

export function isPathInside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

export async function canonicalMutationPath(cwd: string, path: string): Promise<string> {
  const absolutePath = resolveFromCwd(cwd, path);
  let existing = absolutePath;

  while (true) {
    try {
      await lstat(existing);
      break;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      const parent = dirname(existing);
      if (parent === existing) throw error;
      existing = parent;
    }
  }

  const canonicalExisting = await realpath(existing);
  return join(canonicalExisting, relative(existing, absolutePath));
}

export async function isWorkspaceMutation(cwd: string, path: string): Promise<boolean> {
  const [canonicalCwd, canonicalTarget] = await Promise.all([
    realpath(cwd),
    canonicalMutationPath(cwd, path),
  ]);
  return isPathInside(canonicalCwd, canonicalTarget);
}

function expandPolicyPath(cwd: string, path: string): string {
  const expanded = path.replace(/^~(?=$|\/)/, homedir());
  return isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
}

export function sandboxPolicyPaths(cwd: string, paths: readonly string[] | undefined): string[] {
  return (paths ?? []).map((path) => expandPolicyPath(cwd, path));
}

export async function pathMatchesAllowedRoot(
  cwd: string,
  path: string,
  allowedRoots: readonly string[] | undefined,
): Promise<boolean> {
  const target = await canonicalMutationPath(cwd, path);
  for (const root of sandboxPolicyPaths(cwd, allowedRoots)) {
    const canonicalRoot = await canonicalMutationPath(cwd, root);
    if (isPathInside(canonicalRoot, target)) return true;
  }
  return false;
}

export async function isSensitiveWritePath(
  cwd: string,
  path: string,
  policy?: SandboxPolicy,
): Promise<boolean> {
  const canonicalPath = await canonicalMutationPath(cwd, path);
  const patterns = [...DEFAULT_DENY_WRITE_PATTERNS, ...(policy?.denyWrite ?? [])];
  return patterns.some((pattern) => {
    if (pattern.includes("/") || isAbsolute(pattern) || pattern.startsWith("~")) {
      const absolutePattern = expandPolicyPath(cwd, pattern);
      return minimatch(canonicalPath, absolutePattern, { dot: true });
    }
    return minimatch(basename(canonicalPath), pattern, { dot: true, matchBase: true });
  });
}
