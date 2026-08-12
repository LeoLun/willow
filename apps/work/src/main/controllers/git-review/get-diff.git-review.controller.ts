import { GitReviewService } from "@main/service/git-review.service";
import type { ApiResponse, GetGitReviewDiffRequest, GetGitReviewDiffResponse } from "@shared/api";
import { GET_GIT_REVIEW_DIFF } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { GitReviewController } from "./git-review.controller";

@Injectable()
export class GetGitReviewDiffController extends GitReviewController<
  GetGitReviewDiffRequest,
  GetGitReviewDiffResponse
> {
  constructor(private readonly gitReviewService: GitReviewService) {
    super();
  }

  @IPC(GET_GIT_REVIEW_DIFF)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetGitReviewDiffRequest,
  ): Promise<ApiResponse<GetGitReviewDiffResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    try {
      return this.buildResponse({
        diff: await this.gitReviewService.getDiff(
          request.workspaceId,
          request.area,
          request.path,
          request.oldPath,
        ),
      });
    } catch (error) {
      const response = this.mapError(error);
      if (response) return response;
      throw error;
    }
  }

  checkParams(request: GetGitReviewDiffRequest): Error | undefined {
    const workspaceError = this.checkWorkspace(request);
    if (workspaceError) return workspaceError;
    if (request.area !== "staged" && request.area !== "unstaged") {
      return new Error("area must be staged or unstaged");
    }
    return (
      this.checkPath(request.path) ??
      (request.oldPath === undefined ? undefined : this.checkPath(request.oldPath, "oldPath"))
    );
  }
}
