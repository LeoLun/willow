import { readFile, readdir } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import type { FileSearchItem } from "@shared/api";
import { Injectable } from "@willow/poetry";
import ignore from "ignore";
import { WorkspaceService } from "./workspace.service";

const CACHE_TTL_MS = 5_000;
const RESULT_LIMIT = 50;

type FileIndexCache = {
  workspacePath: string;
  expiresAt: number;
  entries: FileSearchItem[];
};

type RankedEntry = {
  entry: FileSearchItem;
  rank: number;
};

@Injectable()
export class FileSearchService {
  private readonly cache = new Map<number, FileIndexCache>();
  private readonly scans = new Map<string, Promise<FileSearchItem[]>>();

  constructor(private readonly workspaceService: WorkspaceService) {}

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

    const scanKey = `${workspaceId}:${workspacePath}`;
    const activeScan = this.scans.get(scanKey);
    if (activeScan) return await activeScan;

    const scan = this.scanWorkspace(workspacePath);
    this.scans.set(scanKey, scan);
    try {
      const entries = await scan;
      this.cache.set(workspaceId, {
        workspacePath,
        expiresAt: Date.now() + CACHE_TTL_MS,
        entries,
      });
      return entries;
    } finally {
      this.scans.delete(scanKey);
    }
  }

  private async scanWorkspace(workspacePath: string): Promise<FileSearchItem[]> {
    const matcher = ignore().add([".git/", "node_modules/"]);
    try {
      matcher.add(await readFile(resolve(workspacePath, ".gitignore"), "utf8"));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }

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

function compareRelativePaths(left: FileSearchItem, right: FileSearchItem): number {
  const leftPath = left.relativePath.toLowerCase();
  const rightPath = right.relativePath.toLowerCase();
  if (leftPath < rightPath) return -1;
  if (leftPath > rightPath) return 1;
  if (left.relativePath < right.relativePath) return -1;
  if (left.relativePath > right.relativePath) return 1;
  return 0;
}

function isOrderedSubsequence(query: string, value: string): boolean {
  let queryIndex = 0;
  for (const character of value) {
    if (character === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return false;
}
