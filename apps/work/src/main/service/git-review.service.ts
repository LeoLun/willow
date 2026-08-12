import { execFile } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type {
  GitReviewArea,
  GitReviewChange,
  GitReviewChangeStatus,
  GitReviewDiff,
  GitReviewStatus,
} from "@shared/api";
import { Injectable } from "@willow/poetry";
import { WorkspaceService } from "./workspace.service";

const COMMAND_TIMEOUT_MS = 15_000;
const STATUS_MAX_BUFFER = 8 * 1024 * 1024;
const DIFF_MAX_BUFFER = 4 * 1024 * 1024;
const MAX_PATH_LENGTH = 4_096;
const MAX_COMMIT_MESSAGE_LENGTH = 10_000;

interface GitCommandResult {
  stderr: string;
  stdout: string;
  truncated: boolean;
}

interface GitCommandOptions {
  acceptedExitCodes?: readonly number[];
  maxBuffer?: number;
}

interface GitCommandFailure extends Error {
  code?: number | string;
  killed?: boolean;
  stderr?: string;
  stdout?: string;
}

export class GitReviewCommandError extends Error {
  constructor(
    message: string,
    readonly exitCode?: number | string,
  ) {
    super(message);
    this.name = "GitReviewCommandError";
  }
}

export class InvalidGitReviewPathError extends Error {
  constructor(path: string) {
    super(`Invalid Git review path: ${path}`);
    this.name = "InvalidGitReviewPathError";
  }
}

@Injectable()
export class GitReviewService {
  constructor(private readonly workspaceService: WorkspaceService) {}

  async getStatus(workspaceId: number): Promise<GitReviewStatus> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    if (!(await this.isRepository(workspace.path))) return { repository: false };

    const [branch, upstream, statusOutput, stagedStats, unstagedStats] = await Promise.all([
      this.getBranch(workspace.path),
      this.getUpstream(workspace.path),
      this.runGit(workspace.path, [
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
        "--",
        ".",
      ]),
      this.runGit(workspace.path, ["diff", "--cached", "--numstat", "-z", "--", "."]),
      this.runGit(workspace.path, ["diff", "--numstat", "-z", "--", "."]),
    ]);
    const changes = parseStatus(statusOutput.stdout);
    const stagedStatMap = parseNumstat(stagedStats.stdout);
    const unstagedStatMap = parseNumstat(unstagedStats.stdout);

    await Promise.all(
      changes.map(async (change) => {
        const stats = (change.area === "staged" ? stagedStatMap : unstagedStatMap).get(change.path);
        if (stats) {
          change.additions = stats.additions;
          change.deletions = stats.deletions;
        } else if (change.status === "untracked") {
          const additions = await countUntrackedLines(workspace.path, change.path);
          if (additions !== undefined) {
            change.additions = additions;
            change.deletions = 0;
          }
        }
      }),
    );

    const staged = changes.filter((change) => change.area === "staged");
    const unstaged = changes.filter((change) => change.area === "unstaged");
    const divergence = upstream
      ? await this.getDivergence(workspace.path)
      : { ahead: 0, behind: 0 };
    return {
      repository: true,
      branch,
      upstream,
      ...divergence,
      additions: sumStats(changes, "additions"),
      deletions: sumStats(changes, "deletions"),
      staged,
      unstaged,
    };
  }

  async getDiff(
    workspaceId: number,
    area: GitReviewArea,
    path: string,
    oldPath?: string,
  ): Promise<GitReviewDiff> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    validateGitPath(workspace.path, path);
    if (oldPath) validateGitPath(workspace.path, oldPath);
    const status = await this.getStatus(workspaceId);
    if (!status.repository) throw new GitReviewCommandError("当前工作区不是 Git 仓库");
    const change = status[area].find(
      (candidate) => candidate.path === path && (!oldPath || candidate.oldPath === oldPath),
    );
    if (!change) throw new InvalidGitReviewPathError(path);

    let result: GitCommandResult;
    if (area === "unstaged" && change.status === "untracked") {
      result = await this.runGit(
        workspace.path,
        [
          "diff",
          "--no-index",
          "--no-ext-diff",
          "--no-color",
          "--unified=3",
          "--",
          process.platform === "win32" ? "NUL" : "/dev/null",
          resolve(workspace.path, change.path),
        ],
        { acceptedExitCodes: [0, 1], maxBuffer: DIFF_MAX_BUFFER },
      );
    } else {
      const paths = uniquePaths(change);
      result = await this.runGit(
        workspace.path,
        [
          "diff",
          ...(area === "staged" ? ["--cached"] : []),
          "--no-ext-diff",
          "--no-color",
          "--unified=3",
          "--",
          ...paths,
        ],
        { maxBuffer: DIFF_MAX_BUFFER },
      );
    }

    return {
      binary: /(^|\n)(Binary files .* differ|GIT binary patch)(\n|$)/.test(result.stdout),
      content: result.stdout,
      truncated: result.truncated,
    };
  }

  async stage(workspaceId: number, paths?: readonly string[]): Promise<void> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    const selected = await this.resolveChanges(workspaceId, "unstaged", paths);
    if (paths && selected.length === 0) throw new InvalidGitReviewPathError(paths[0] ?? "");
    await this.runGit(workspace.path, [
      "add",
      "-A",
      "--",
      ...(paths ? selected.flatMap(uniquePaths) : ["."]),
    ]);
  }

  async unstage(workspaceId: number, paths?: readonly string[]): Promise<void> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    const selected = await this.resolveChanges(workspaceId, "staged", paths);
    if (paths && selected.length === 0) throw new InvalidGitReviewPathError(paths[0] ?? "");
    const pathspecs = paths ? selected.flatMap(uniquePaths) : ["."];
    if (await this.hasHead(workspace.path)) {
      await this.runGit(workspace.path, ["reset", "-q", "HEAD", "--", ...pathspecs]);
    } else {
      await this.runGit(workspace.path, [
        "rm",
        "--cached",
        "-r",
        "--ignore-unmatch",
        "--",
        ...pathspecs,
      ]);
    }
  }

  async commit(workspaceId: number, message: string): Promise<string> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    const normalizedMessage = message.trim();
    if (!normalizedMessage) throw new GitReviewCommandError("提交信息不能为空");
    if (normalizedMessage.length > MAX_COMMIT_MESSAGE_LENGTH) {
      throw new GitReviewCommandError(
        `提交信息不能超过 ${MAX_COMMIT_MESSAGE_LENGTH.toLocaleString()} 个字符`,
      );
    }
    const status = await this.getStatus(workspaceId);
    if (!status.repository) throw new GitReviewCommandError("当前工作区不是 Git 仓库");
    if (status.staged.length === 0) throw new GitReviewCommandError("没有已暂存的变更");
    await this.runGit(workspace.path, ["commit", "-m", normalizedMessage]);
    return (await this.runGit(workspace.path, ["rev-parse", "HEAD"])).stdout.trim();
  }

  private async resolveChanges(
    workspaceId: number,
    area: GitReviewArea,
    paths?: readonly string[],
  ): Promise<GitReviewChange[]> {
    const status = await this.getStatus(workspaceId);
    if (!status.repository) throw new GitReviewCommandError("当前工作区不是 Git 仓库");
    if (!paths) return status[area];
    const requestedPaths = new Set(paths);
    const selected = status[area].filter((change) => requestedPaths.has(change.path));
    if (selected.length !== requestedPaths.size) {
      const invalidPath = paths.find((path) => !selected.some((change) => change.path === path));
      throw new InvalidGitReviewPathError(invalidPath ?? "");
    }
    return selected;
  }

  private async isRepository(cwd: string): Promise<boolean> {
    try {
      const result = await this.runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
      return result.stdout.trim() === "true";
    } catch (error) {
      if (error instanceof GitReviewCommandError && error.exitCode === 128) return false;
      throw error;
    }
  }

  private async hasHead(cwd: string): Promise<boolean> {
    try {
      await this.runGit(cwd, ["rev-parse", "--verify", "HEAD"]);
      return true;
    } catch (error) {
      if (error instanceof GitReviewCommandError && error.exitCode === 128) return false;
      throw error;
    }
  }

  private async getBranch(cwd: string): Promise<string> {
    try {
      return (await this.runGit(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"])).stdout.trim();
    } catch (error) {
      if (!(error instanceof GitReviewCommandError) || error.exitCode !== 1) throw error;
      try {
        return (await this.runGit(cwd, ["rev-parse", "--short", "HEAD"])).stdout.trim();
      } catch (headError) {
        if (headError instanceof GitReviewCommandError && headError.exitCode === 128) {
          return "未提交";
        }
        throw headError;
      }
    }
  }

  private async getUpstream(cwd: string): Promise<string | undefined> {
    try {
      return (
        await this.runGit(cwd, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])
      ).stdout.trim();
    } catch (error) {
      if (error instanceof GitReviewCommandError && error.exitCode === 128) return undefined;
      throw error;
    }
  }

  private async getDivergence(cwd: string): Promise<{ ahead: number; behind: number }> {
    const output = (
      await this.runGit(cwd, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])
    ).stdout.trim();
    const [ahead = 0, behind = 0] = output.split(/\s+/).map(Number);
    return { ahead, behind };
  }

  private runGit(
    cwd: string,
    args: readonly string[],
    options: GitCommandOptions = {},
  ): Promise<GitCommandResult> {
    const acceptedExitCodes = options.acceptedExitCodes ?? [0];
    const maxBuffer = options.maxBuffer ?? STATUS_MAX_BUFFER;
    return new Promise((resolvePromise, rejectPromise) => {
      execFile(
        "git",
        args,
        {
          cwd,
          encoding: "utf8",
          maxBuffer,
          timeout: COMMAND_TIMEOUT_MS,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          const failure = error as GitCommandFailure | null;
          const exitCode = typeof failure?.code === "number" ? failure.code : undefined;
          if (!failure || (exitCode !== undefined && acceptedExitCodes.includes(exitCode))) {
            resolvePromise({ stderr, stdout, truncated: false });
            return;
          }
          if (failure.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
            resolvePromise({
              stderr: failure.stderr ?? stderr,
              stdout: failure.stdout ?? stdout,
              truncated: true,
            });
            return;
          }
          const detail = (failure.stderr ?? stderr).trim() || failure.message;
          rejectPromise(new GitReviewCommandError(detail, failure.code));
        },
      );
    });
  }
}

function validateGitPath(workspacePath: string, path: string): void {
  if (
    !path ||
    path.length > MAX_PATH_LENGTH ||
    isAbsolute(path) ||
    path.includes("\0") ||
    path.includes("\r") ||
    path.includes("\n")
  ) {
    throw new InvalidGitReviewPathError(path);
  }
  const target = resolve(workspacePath, path);
  const relativePath = relative(workspacePath, target);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(relativePath)
  ) {
    throw new InvalidGitReviewPathError(path);
  }
}

function parseStatus(output: string): GitReviewChange[] {
  const records = output.split("\0");
  const changes: GitReviewChange[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || record.length < 4) continue;
    const x = record[0] ?? " ";
    const y = record[1] ?? " ";
    const path = record.slice(3);
    const renamed = x === "R" || x === "C" || y === "R" || y === "C";
    const oldPath = renamed ? records[++index] : undefined;
    const conflict = isConflictStatus(x, y);
    if (conflict) {
      changes.push({ area: "unstaged", oldPath, path, status: "conflicted" });
      continue;
    }
    if (x === "?" && y === "?") {
      changes.push({ area: "unstaged", path, status: "untracked" });
      continue;
    }
    if (x !== " " && x !== "!") {
      changes.push({
        area: "staged",
        ...(x === "R" || x === "C" ? { oldPath } : {}),
        path,
        status: statusForCode(x),
      });
    }
    if (y !== " " && y !== "!") {
      changes.push({
        area: "unstaged",
        ...(y === "R" || y === "C" ? { oldPath } : {}),
        path,
        status: statusForCode(y),
      });
    }
  }
  return changes;
}

function isConflictStatus(x: string, y: string): boolean {
  return x === "U" || y === "U" || ["DD", "AU", "UD", "UA", "DU", "AA"].includes(`${x}${y}`);
}

function statusForCode(code: string): GitReviewChangeStatus {
  if (code === "A") return "added";
  if (code === "D") return "deleted";
  if (code === "R") return "renamed";
  if (code === "C") return "copied";
  if (code === "T") return "typeChanged";
  return "modified";
}

function parseNumstat(
  output: string,
): Map<string, Pick<GitReviewChange, "additions" | "deletions">> {
  const records = output.split("\0");
  const result = new Map<string, Pick<GitReviewChange, "additions" | "deletions">>();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    const [rawAdditions, rawDeletions, inlinePath = ""] = record.split("\t");
    const path = inlinePath || records[index + 2];
    if (!inlinePath) index += 2;
    if (!path) continue;
    result.set(path, {
      additions: rawAdditions === "-" ? undefined : Number(rawAdditions),
      deletions: rawDeletions === "-" ? undefined : Number(rawDeletions),
    });
  }
  return result;
}

async function countUntrackedLines(
  workspacePath: string,
  path: string,
): Promise<number | undefined> {
  validateGitPath(workspacePath, path);
  const absolutePath = resolve(workspacePath, path);
  const details = await lstat(absolutePath);
  if (!details.isFile() || details.size > DIFF_MAX_BUFFER) return undefined;
  const bytes = await readFile(absolutePath);
  if (bytes.includes(0)) return undefined;
  if (bytes.length === 0) return 0;
  let lines = 0;
  for (const byte of bytes) if (byte === 10) lines += 1;
  return lines + (bytes.at(-1) === 10 ? 0 : 1);
}

function uniquePaths(change: GitReviewChange): string[] {
  return [
    ...new Set([change.oldPath, change.path].filter((path): path is string => Boolean(path))),
  ];
}

function sumStats(changes: readonly GitReviewChange[], key: "additions" | "deletions"): number {
  return changes.reduce((total, change) => total + (change[key] ?? 0), 0);
}
