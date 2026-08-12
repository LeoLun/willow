import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GitReviewService,
  InvalidGitReviewPathError,
} from "../src/main/service/git-review.service";
import type { WorkspaceService } from "../src/main/service/workspace.service";

const run = promisify(execFile);
let root = "";
let service: GitReviewService;

async function git(...args: string[]): Promise<string> {
  return (await run("git", args, { cwd: root, encoding: "utf8" })).stdout;
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "willow-git-review-"));
  await git("init", "-q");
  await git("config", "user.email", "willow@example.com");
  await git("config", "user.name", "Willow Test");
  const workspaceService = {
    getWorkspaceDetail: () => ({ id: 1, name: "repo", path: root }),
  } as unknown as WorkspaceService;
  service = new GitReviewService(workspaceService);
});

afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

describe("GitReviewService", () => {
  it("reports non-repositories without executing review operations", async () => {
    await rm(join(root, ".git"), { force: true, recursive: true });
    await expect(service.getStatus(1)).resolves.toEqual({ repository: false });
  });

  it("tracks staged and unstaged changes independently and returns their diffs", async () => {
    await writeFile(join(root, "tracked.txt"), "first\n");
    await git("add", "tracked.txt");
    await git("commit", "-qm", "initial");
    await writeFile(join(root, "tracked.txt"), "first\nstaged\n");
    await service.stage(1, ["tracked.txt"]);
    await writeFile(join(root, "tracked.txt"), "first\nstaged\nunstaged\n");

    const status = await service.getStatus(1);
    expect(status.repository).toBe(true);
    if (!status.repository) return;
    expect(status.staged).toEqual([
      expect.objectContaining({ area: "staged", path: "tracked.txt", additions: 1 }),
    ]);
    expect(status.unstaged).toEqual([
      expect.objectContaining({ area: "unstaged", path: "tracked.txt", additions: 1 }),
    ]);
    await expect(service.getDiff(1, "staged", "tracked.txt")).resolves.toEqual(
      expect.objectContaining({ binary: false, content: expect.stringContaining("+staged") }),
    );
    await expect(service.getDiff(1, "unstaged", "tracked.txt")).resolves.toEqual(
      expect.objectContaining({ binary: false, content: expect.stringContaining("+unstaged") }),
    );
  });

  it("supports untracked files, staging, unstaging before the first commit, and committing", async () => {
    await writeFile(join(root, "new.txt"), "one\ntwo\n");
    const initial = await service.getStatus(1);
    expect(initial.repository && initial.unstaged[0]).toEqual(
      expect.objectContaining({ path: "new.txt", status: "untracked", additions: 2 }),
    );
    expect((await service.getDiff(1, "unstaged", "new.txt")).content).toContain("+one");

    await service.stage(1, ["new.txt"]);
    let status = await service.getStatus(1);
    expect(status.repository && status.staged).toHaveLength(1);
    await service.unstage(1, ["new.txt"]);
    status = await service.getStatus(1);
    expect(status.repository && status.unstaged[0]?.status).toBe("untracked");

    await service.stage(1);
    const hash = await service.commit(1, "  feat: first commit  ");
    expect(hash).toMatch(/^[0-9a-f]{40}$/);
    expect((await git("log", "-1", "--pretty=%s")).trim()).toBe("feat: first commit");
  });

  it("reports renames, deletion, binary changes, branch information, and no upstream", async () => {
    await writeFile(join(root, "old.txt"), "old\n");
    await writeFile(join(root, "binary.bin"), Buffer.from([0, 1, 2]));
    await git("add", ".");
    await git("commit", "-qm", "initial");
    await git("mv", "old.txt", "new.txt");
    await writeFile(join(root, "binary.bin"), Buffer.from([0, 9, 2]));

    const status = await service.getStatus(1);
    expect(status.repository).toBe(true);
    if (!status.repository) return;
    expect(status.upstream).toBeUndefined();
    expect(status.staged).toContainEqual(
      expect.objectContaining({ oldPath: "old.txt", path: "new.txt", status: "renamed" }),
    );
    expect(status.unstaged).toContainEqual(
      expect.objectContaining({ path: "binary.bin", additions: undefined, deletions: undefined }),
    );
    expect((await service.getDiff(1, "unstaged", "binary.bin")).binary).toBe(true);
  });

  it("rejects paths that are not current changes", async () => {
    await writeFile(join(root, "new.txt"), "content\n");
    await expect(service.getDiff(1, "unstaged", "../outside.txt")).rejects.toBeInstanceOf(
      InvalidGitReviewPathError,
    );
    await expect(service.stage(1, ["missing.txt"])).rejects.toBeInstanceOf(
      InvalidGitReviewPathError,
    );
    await expect(readFile(join(root, "new.txt"), "utf8")).resolves.toBe("content\n");
  });
});
