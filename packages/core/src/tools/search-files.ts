import { readFile, readdir } from "node:fs/promises";
import { basename, relative } from "node:path";
import ignore, { type Ignore } from "ignore";
import { resolveFromCwd, throwIfAborted } from "./shared.js";

export type SearchFile = {
  absolutePath: string;
  relativePath: string;
};

async function loadIgnore(root: string, explicitSkippedRoot: boolean): Promise<Ignore> {
  const matcher = ignore();
  if (!explicitSkippedRoot) matcher.add([".git/", "node_modules/"]);
  try {
    matcher.add(await readFile(resolveFromCwd(root, ".gitignore"), "utf8"));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  return matcher;
}

async function walkFiles(root: string, signal?: AbortSignal): Promise<SearchFile[]> {
  const explicitSkippedRoot = basename(root) === ".git" || basename(root) === "node_modules";
  const matcher = await loadIgnore(root, explicitSkippedRoot);
  const files: SearchFile[] = [];

  async function walk(directory: string): Promise<void> {
    throwIfAborted(signal);
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      throwIfAborted(signal);
      const absolutePath = resolveFromCwd(directory, entry.name);
      const relativePath = relative(root, absolutePath).split("\\").join("/");
      if (matcher.ignores(relativePath + (entry.isDirectory() ? "/" : ""))) continue;
      if (entry.isDirectory()) await walk(absolutePath);
      else if (entry.isFile()) files.push({ absolutePath, relativePath });
    }
  }

  await walk(root);
  return files;
}

export async function resolveSearchFiles(
  cwd: string,
  path: string | undefined,
  signal?: AbortSignal,
): Promise<SearchFile[]> {
  const root = resolveFromCwd(cwd, path || ".");
  const entries = await readdir(root).catch((error) => {
    if (error instanceof Error && "code" in error && error.code === "ENOTDIR") return undefined;
    throw error;
  });
  if (entries === undefined) {
    return [{ absolutePath: root, relativePath: basename(root) }];
  }
  return await walkFiles(root, signal);
}
