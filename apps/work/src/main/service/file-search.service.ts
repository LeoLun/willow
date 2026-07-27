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
  files: FileSearchItem[];
};

type RankedFile = {
  file: FileSearchItem;
  rank: number;
};

@Injectable()
export class FileSearchService {
  private readonly cache = new Map<number, FileIndexCache>();
  private readonly scans = new Map<string, Promise<FileSearchItem[]>>();

  constructor(private readonly workspaceService: WorkspaceService) {}

  async searchFiles(workspaceId: number, query: string): Promise<FileSearchItem[]> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    const files = await this.getFileIndex(workspaceId, workspace.path);
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return files.slice(0, RESULT_LIMIT);

    return files
      .map((file): RankedFile | undefined => {
        const rank = this.rankFile(file, normalizedQuery);
        return rank === undefined ? undefined : { file, rank };
      })
      .filter((result): result is RankedFile => result !== undefined)
      .sort((left, right) => left.rank - right.rank || compareRelativePaths(left.file, right.file))
      .slice(0, RESULT_LIMIT)
      .map(({ file }) => file);
  }

  private async getFileIndex(
    workspaceId: number,
    workspacePath: string,
  ): Promise<FileSearchItem[]> {
    const cached = this.cache.get(workspaceId);
    if (cached && cached.workspacePath === workspacePath && cached.expiresAt > Date.now()) {
      return cached.files;
    }

    const scanKey = `${workspaceId}:${workspacePath}`;
    const activeScan = this.scans.get(scanKey);
    if (activeScan) return await activeScan;

    const scan = this.scanWorkspace(workspacePath);
    this.scans.set(scanKey, scan);
    try {
      const files = await scan;
      this.cache.set(workspaceId, {
        workspacePath,
        expiresAt: Date.now() + CACHE_TTL_MS,
        files,
      });
      return files;
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

    const files: FileSearchItem[] = [];
    const walk = async (directory: string): Promise<void> => {
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const absolutePath = resolve(directory, entry.name);
        const relativePath = relative(workspacePath, absolutePath).split("\\").join("/");
        const ignoredPath = entry.isDirectory() ? `${relativePath}/` : relativePath;
        if (matcher.ignores(ignoredPath)) continue;
        if (entry.isDirectory()) {
          await walk(absolutePath);
        } else if (entry.isFile() && !/[\r\n]/.test(relativePath)) {
          files.push({ name: basename(relativePath), relativePath });
        }
      }
    };

    await walk(workspacePath);
    return files.sort(compareRelativePaths);
  }

  private rankFile(file: FileSearchItem, query: string): number | undefined {
    const name = file.name.toLowerCase();
    const path = file.relativePath.toLowerCase();
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
