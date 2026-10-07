import { lstat, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalMutationPath, isPathInside } from "../tools/policy.js";
import type { MemoryOptions, MemoryScope } from "./types.js";

export function getMemoryPath(options: MemoryOptions, scope: MemoryScope, config = false): string {
  return join(
    scope === "global" ? homedir() : resolve(options.cwd),
    ".willow",
    "memory",
    config ? "config.json" : "MEMORY.md",
  );
}

/** Only the workspace/home anchor may resolve through symlinks; memory components may not. */
export async function authorizeMemoryPath(
  options: MemoryOptions,
  scope: MemoryScope,
  config = false,
): Promise<string> {
  if (scope !== "global" && scope !== "project") throw new Error("Invalid memory scope");
  if (scope === "project" && !options.projectTrusted)
    throw new Error("Project memory requires a trusted workspace");
  const anchor = await realpath(scope === "global" ? homedir() : options.cwd);
  const home = await realpath(homedir());
  for (const root of [".ssh", ".aws", ".azure", ".gnupg", ".kube", ".config/gcloud"]) {
    const sensitiveRoot = await canonicalMutationPath(home, join(home, root));
    if (isPathInside(sensitiveRoot, anchor))
      throw new Error("Memory cannot reside in a credential directory");
  }
  if (/(?:^|\/)\.git(?:\/|$)/.test(anchor)) throw new Error("Memory cannot reside in Git metadata");
  let target = anchor;
  const parts = [".willow", "memory", config ? "config.json" : "MEMORY.md"];
  for (const [index, part] of parts.entries()) {
    target = join(target, part);
    try {
      const stat = await lstat(target);
      if (stat.isSymbolicLink()) throw new Error(`Memory symlink is not allowed: ${target}`);
      if (index < 2 ? !stat.isDirectory() : !stat.isFile())
        throw new Error(`Invalid memory path: ${target}`);
      if (index === 2 && stat.nlink > 1)
        throw new Error(`Memory hard link is not allowed: ${target}`);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }
  return target;
}

export function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
