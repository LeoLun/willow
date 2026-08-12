import { GitReviewService } from "@main/service/git-review.service";
import type { ApiResponse, CommitGitChangesRequest, CommitGitChangesResponse } from "@shared/api";
import { COMMIT_GIT_CHANGES } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { GitReviewController } from "./git-review.controller";

const MAX_COMMIT_MESSAGE_LENGTH = 10_000;

@Injectable()
export class CommitGitChangesController extends GitReviewController<
  CommitGitChangesRequest,
  CommitGitChangesResponse
> {
  constructor(private readonly gitReviewService: GitReviewService) {
    super();
  }

  @IPC(COMMIT_GIT_CHANGES)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: CommitGitChangesRequest,
  ): Promise<ApiResponse<CommitGitChangesResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    try {
      return this.buildResponse({
        commitHash: await this.gitReviewService.commit(request.workspaceId, request.message),
      });
    } catch (error) {
      const response = this.mapError(error);
      if (response) return response;
      throw error;
    }
  }

  checkParams(request: CommitGitChangesRequest): Error | undefined {
    const workspaceError = this.checkWorkspace(request);
    if (workspaceError) return workspaceError;
    if (typeof request.message !== "string" || request.message.trim().length === 0) {
      return new Error("message must be a non-empty string");
    }
    if (request.message.length > MAX_COMMIT_MESSAGE_LENGTH) {
      return new Error(`message must not exceed ${MAX_COMMIT_MESSAGE_LENGTH} characters`);
    }
    return undefined;
  }
}
