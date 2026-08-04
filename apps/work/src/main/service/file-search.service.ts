import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import type {
  FileSearchItem,
  ListWorkspaceDirectoryResponse,
  WorkspaceFileContent,
} from "@shared/api";
import { Injectable } from "@willow/poetry";
import ignore, { type Ignore } from "ignore";
import { WorkspaceService } from "./workspace.service";

const CACHE_TTL_MS = 5_000;
const DEFAULT_DIRECTORY_LIMIT = 200;
const MAX_FILE_PREVIEW_BYTES = 1024 * 1024;
const RESULT_LIMIT = 50;

type FileIndexCache = {
  workspacePath: string;
  expiresAt: number;
  entries: FileSearchItem[];
};

type IgnoreCache = {
  workspacePath: string;
  matcher: Ignore;
};

type RankedEntry = {
  entry: FileSearchItem;
  rank: number;
};

type DirectoryCursor = Pick<FileSearchItem, "relativePath" | "type">;

export class InvalidWorkspaceFilePathError extends Error {
  constructor(path: string) {
    super(`Invalid workspace file path: ${path}`);
    this.name = "InvalidWorkspaceFilePathError";
  }
}

export class WorkspaceFileNotFoundError extends Error {
  constructor(path: string) {
    super(`Workspace file not found: ${path}`);
    this.name = "WorkspaceFileNotFoundError";
  }
}

@Injectable()
export class FileSearchService {
  private readonly cache = new Map<number, FileIndexCache>();
  private readonly cacheVersions = new Map<number, number>();
  private readonly ignoreCache = new Map<number, IgnoreCache>();
  private readonly scans = new Map<string, Promise<FileSearchItem[]>>();

  constructor(private readonly workspaceService: WorkspaceService) {}

  invalidateWorkspace(workspaceId: number): void {
    this.cache.delete(workspaceId);
    this.ignoreCache.delete(workspaceId);
    this.cacheVersions.set(workspaceId, (this.cacheVersions.get(workspaceId) ?? 0) + 1);
  }

  async listDirectory(
    workspaceId: number,
    directoryPath: string,
    cursor?: string,
    limit = DEFAULT_DIRECTORY_LIMIT,
  ): Promise<ListWorkspaceDirectoryResponse> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    const normalizedDirectoryPath = normalizeRelativePath(directoryPath, true);
    const directory = await this.resolveExistingPath(workspace.path, normalizedDirectoryPath);
    const details = await lstat(directory.absolutePath);
    if (!details.isDirectory()) throw new InvalidWorkspaceFilePathError(directoryPath);

    const matcher = await this.getIgnoreMatcher(workspaceId, workspace.path);
    const directoryEntries = await readdir(directory.absolutePath, { withFileTypes: true });
    const entries: FileSearchItem[] = [];

    for (const directoryEntry of directoryEntries) {
      if (directoryEntry.isSymbolicLink()) continue;
      if (!directoryEntry.isDirectory() && !directoryEntry.isFile()) continue;

      const relativePath = joinRelativePath(normalizedDirectoryPath, directoryEntry.name);
      if (/\r|\n/.test(relativePath)) continue;
      const ignoredPath = directoryEntry.isDirectory() ? `${relativePath}/` : relativePath;
      if (matcher.ignores(ignoredPath)) continue;
      entries.push({
        name: directoryEntry.name,
        relativePath: ignoredPath,
        type: directoryEntry.isDirectory() ? "directory" : "file",
      });
    }

    entries.sort(compareDirectoryEntries);
    const startIndex = cursor ? findCursorIndex(entries, decodeDirectoryCursor(cursor)) + 1 : 0;
    const page = entries.slice(startIndex, startIndex + limit);
    const hasNextPage = startIndex + page.length < entries.length;
    return {
      entries: page,
      ...(hasNextPage && page.length > 0
        ? { nextCursor: encodeDirectoryCursor(page[page.length - 1]!) }
        : {}),
    };
  }

  async readWorkspaceFile(
    workspaceId: number,
    relativePath: string,
  ): Promise<WorkspaceFileContent> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    const normalizedPath = normalizeRelativePath(relativePath, false);
    const file = await this.resolveExistingPath(workspace.path, normalizedPath);
    const details = await lstat(file.absolutePath);
    if (!details.isFile()) throw new InvalidWorkspaceFilePathError(relativePath);

    const metadata = {
      modifiedAt: details.mtimeMs,
      name: basename(normalizedPath),
      relativePath: normalizedPath,
      size: details.size,
    };
    if (details.size > MAX_FILE_PREVIEW_BYTES) {
      return { ...metadata, status: "too-large" };
    }

    const bytes = await readFile(file.absolutePath);
    if (bytes.includes(0)) return { ...metadata, status: "binary" };
    try {
      const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return { ...metadata, content, status: "ready" };
    } catch {
      return { ...metadata, status: "binary" };
    }
  }

  async resolveWorkspaceFilePath(workspaceId: number, relativePath: string): Promise<string> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    const normalizedPath = normalizeRelativePath(relativePath, false);
    const file = await this.resolveExistingPath(workspace.path, normalizedPath);
    const details = await lstat(file.absolutePath);
    if (!details.isFile()) throw new InvalidWorkspaceFilePathError(relativePath);
    return file.absolutePath;
  }

  async resolveWorkspaceEntryPath(workspaceId: number, relativePath: string): Promise<string> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    const normalizedPath = normalizeRelativePath(relativePath, false);
    const entry = await this.resolveExistingPath(workspace.path, normalizedPath);
    const details = await lstat(entry.absolutePath);
    if (!details.isFile() && !details.isDirectory()) {
      throw new InvalidWorkspaceFilePathError(relativePath);
    }
    return entry.absolutePath;
  }

  async searchFiles(workspaceId: number, query: string): Promise<FileSearchItem[]> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    const entries = await this.getFileIndex(workspaceId, workspace.path);
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return entries.filter((entry) => entry.type === "file").slice(0, RESULT_LIMIT);
    }

    return entries
      .map((entry): RankedEntry | undefined => {
        const rank = this.rankEntry(entry, normalizedQuery);
        return rank === undefined ? undefined : { entry, rank };
      })
      .filter((result): result is RankedEntry => result !== undefined)
      .sort(
        (left, right) => left.rank - right.rank || compareRelativePaths(left.entry, right.entry),
      )
      .slice(0, RESULT_LIMIT)
      .map(({ entry }) => entry);
  }

  private async getFileIndex(
    workspaceId: number,
    workspacePath: string,
  ): Promise<FileSearchItem[]> {
    const cached = this.cache.get(workspaceId);
    if (cached && cached.workspacePath === workspacePath && cached.expiresAt > Date.now()) {
      return cached.entries;
    }

    const cacheVersion = this.cacheVersions.get(workspaceId) ?? 0;
    const scanKey = `${workspaceId}:${workspacePath}:${cacheVersion}`;
    const activeScan = this.scans.get(scanKey);
    if (activeScan) return await activeScan;

    const scan = this.scanWorkspace(workspaceId, workspacePath);
    this.scans.set(scanKey, scan);
    try {
      const entries = await scan;
      if ((this.cacheVersions.get(workspaceId) ?? 0) === cacheVersion) {
        this.cache.set(workspaceId, {
          workspacePath,
          expiresAt: Date.now() + CACHE_TTL_MS,
          entries,
        });
      }
      return entries;
    } finally {
      this.scans.delete(scanKey);
    }
  }

  private async getIgnoreMatcher(workspaceId: number, workspacePath: string): Promise<Ignore> {
    const cached = this.ignoreCache.get(workspaceId);
    if (cached?.workspacePath === workspacePath) return cached.matcher;

    const matcher = ignore().add([".git/", "node_modules/"]);
    try {
      matcher.add(await readFile(resolve(workspacePath, ".gitignore"), "utf8"));
    } catch (error) {
      if (!isFileSystemError(error, "ENOENT")) throw error;
    }
    this.ignoreCache.set(workspaceId, { matcher, workspacePath });
    return matcher;
  }

  private async resolveExistingPath(
    workspacePath: string,
    relativePath: string,
  ): Promise<{ absolutePath: string; workspaceRoot: string }> {
    const workspaceRoot = await realpath(workspacePath);
    const requestedPath = resolve(workspaceRoot, relativePath || ".");
    let absolutePath: string;
    try {
      absolutePath = await realpath(requestedPath);
    } catch (error) {
      if (isFileSystemError(error, "ENOENT")) throw new WorkspaceFileNotFoundError(relativePath);
      throw error;
    }
    if (!isPathInside(workspaceRoot, absolutePath)) {
      throw new InvalidWorkspaceFilePathError(relativePath);
    }
    return { absolutePath, workspaceRoot };
  }

  private async scanWorkspace(
    workspaceId: number,
    workspacePath: string,
  ): Promise<FileSearchItem[]> {
    const matcher = await this.getIgnoreMatcher(workspaceId, workspacePath);
    const entries: FileSearchItem[] = [];
    const walk = async (directory: string): Promise<void> => {
      const directoryEntries = await readdir(directory, { withFileTypes: true });
      for (const directoryEntry of directoryEntries) {
        if (directoryEntry.isSymbolicLink()) continue;
        const absolutePath = resolve(directory, directoryEntry.name);
        const relativePath = relative(workspacePath, absolutePath).split("\\").join("/");
        const ignoredPath = directoryEntry.isDirectory() ? `${relativePath}/` : relativePath;
        if (matcher.ignores(ignoredPath)) continue;
        if (directoryEntry.isDirectory()) {
          if (!/[\r\n]/.test(relativePath)) {
            entries.push({
              name: directoryEntry.name,
              relativePath: `${relativePath}/`,
              type: "directory",
            });
          }
          await walk(absolutePath);
        } else if (directoryEntry.isFile() && !/[\r\n]/.test(relativePath)) {
          entries.push({ name: basename(relativePath), relativePath, type: "file" });
        }
      }
    };

    await walk(workspacePath);
    return entries.sort(compareRelativePaths);
  }

  private rankEntry(entry: FileSearchItem, query: string): number | undefined {
    const name = entry.name.toLowerCase();
    const path = entry.relativePath.toLowerCase();
    if (name === query) return 0;
    if (name.startsWith(query)) return 1;
    if (name.includes(query)) return 2;
    if (path.includes(query)) return 3;
    if (isOrderedSubsequence(query, path)) return 4;
    return undefined;
  }
}

function compareDirectoryEntries(left: FileSearchItem, right: FileSearchItem): number {
  if (left.type !== right.type) return left.type === "directory" ? -1 : 1;
  return compareRelativePaths(left, right);
}

function compareRelativePaths(left: FileSearchItem, right: FileSearchItem): number {
  const leftPath = left.relativePath.toLowerCase();
  const rightPath = right.relativePath.toLowerCase();
  if (leftPath < rightPath) return -1;
  if (leftPath > rightPath) return 1;
  if (left.relativePath < right.relativePath) return -1;
  if (left.relativePath > right.relativePath) return 1;
  return 0;
}

function decodeDirectoryCursor(cursor: string): DirectoryCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("relativePath" in parsed) ||
      typeof parsed.relativePath !== "string" ||
      !("type" in parsed) ||
      (parsed.type !== "directory" && parsed.type !== "file")
    ) {
      throw new Error("invalid cursor");
    }
    return { relativePath: parsed.relativePath, type: parsed.type };
  } catch {
    throw new InvalidWorkspaceFilePathError("directory cursor");
  }
}

function encodeDirectoryCursor(entry: FileSearchItem): string {
  return Buffer.from(
    JSON.stringify({ relativePath: entry.relativePath, type: entry.type }),
  ).toString("base64url");
}

function findCursorIndex(entries: FileSearchItem[], cursor: DirectoryCursor): number {
  const index = entries.findIndex(
    (entry) => entry.relativePath === cursor.relativePath && entry.type === cursor.type,
  );
  if (index < 0) throw new InvalidWorkspaceFilePathError("directory cursor");
  return index;
}

function isFileSystemError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function isOrderedSubsequence(query: string, value: string): boolean {
  let queryIndex = 0;
  for (const character of value) {
    if (character === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return false;
}

function isPathInside(root: string, path: string): boolean {
  const relativePath = relative(root, path);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function joinRelativePath(directoryPath: string, name: string): string {
  return directoryPath ? `${directoryPath}/${name}` : name;
}

function normalizeRelativePath(path: string, allowRoot: boolean): string {
  if (typeof path !== "string" || path.includes("\0") || /[\r\n]/.test(path) || isAbsolute(path)) {
    throw new InvalidWorkspaceFilePathError(String(path));
  }
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "");
  if (!normalized) {
    if (allowRoot) return "";
    throw new InvalidWorkspaceFilePathError(path);
  }
  if (normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new InvalidWorkspaceFilePathError(path);
  }
  return normalized;
}
