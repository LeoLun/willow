import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommitGitChangesController } from "../src/main/controllers/git-review/commit.git-review.controller";
import { GetGitReviewDiffController } from "../src/main/controllers/git-review/get-diff.git-review.controller";
import { GetGitReviewStatusController } from "../src/main/controllers/git-review/get-status.git-review.controller";
import { StageGitChangesController } from "../src/main/controllers/git-review/stage.git-review.controller";
import type { GitReviewService } from "../src/main/service/git-review.service";

const event = undefined as unknown as Electron.IpcMainInvokeEvent;
const getStatus = vi.fn<GitReviewService["getStatus"]>();
const getDiff = vi.fn<GitReviewService["getDiff"]>();
const stage = vi.fn<GitReviewService["stage"]>();
const commit = vi.fn<GitReviewService["commit"]>();
const service = { getStatus, getDiff, stage, commit } as unknown as GitReviewService;

beforeEach(() => vi.clearAllMocks());

describe("Git review controllers", () => {
  it("gets Git status and delegates valid requests", async () => {
    getStatus.mockResolvedValueOnce({ repository: false });
    const controller = new GetGitReviewStatusController(service);
    await expect(controller.run(event, { workspaceId: 3 })).resolves.toEqual({
      code: 0,
      data: { review: { repository: false } },
      msg: "ok",
    });
    expect(getStatus).toHaveBeenCalledWith(3);
  });

  it("rejects invalid diff requests without calling the service", async () => {
    const controller = new GetGitReviewDiffController(service);
    await expect(
      controller.run(event, { workspaceId: 1, area: "other", path: "a.txt" } as never),
    ).resolves.toEqual({ code: 400, msg: "area must be staged or unstaged" });
    await expect(
      controller.run(event, { workspaceId: 1, area: "staged", path: "" }),
    ).resolves.toEqual({ code: 400, msg: "path must be a non-empty string" });
    expect(getDiff).not.toHaveBeenCalled();
  });

  it("validates index paths before staging", async () => {
    const controller = new StageGitChangesController(service);
    await expect(controller.run(event, { workspaceId: 0 })).resolves.toEqual({
      code: 400,
      msg: "workspaceId must be a positive integer",
    });
    await expect(controller.run(event, { workspaceId: 1, paths: [] })).resolves.toEqual({
      code: 400,
      msg: "paths must not be empty",
    });
    expect(stage).not.toHaveBeenCalled();
  });

  it("requires a non-empty commit message and returns the commit hash", async () => {
    const controller = new CommitGitChangesController(service);
    await expect(controller.run(event, { workspaceId: 1, message: "  " })).resolves.toEqual({
      code: 400,
      msg: "message must be a non-empty string",
    });
    commit.mockResolvedValueOnce("abc123");
    await expect(
      controller.run(event, { workspaceId: 1, message: "feat: review" }),
    ).resolves.toEqual({
      code: 0,
      data: { commitHash: "abc123" },
      msg: "ok",
    });
  });
});
