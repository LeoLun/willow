import { GitReviewService } from "@main/service/git-review.service";
import type {
  ApiResponse,
  UpdateGitReviewIndexRequest,
  UpdateGitReviewIndexResponse,
} from "@shared/api";
import { UNSTAGE_GIT_CHANGES } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { GitReviewController } from "./git-review.controller";

@Injectable()
export class UnstageGitChangesController extends GitReviewController<
  UpdateGitReviewIndexRequest,
  UpdateGitReviewIndexResponse
> {
  constructor(private readonly gitReviewService: GitReviewService) {
    super();
  }

  @IPC(UNSTAGE_GIT_CHANGES)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: UpdateGitReviewIndexRequest,
  ): Promise<ApiResponse<UpdateGitReviewIndexResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    try {
      await this.gitReviewService.unstage(request.workspaceId, request.paths);
      return this.buildResponse({});
    } catch (error) {
      const response = this.mapError(error);
      if (response) return response;
      throw error;
    }
  }

  checkParams(request: UpdateGitReviewIndexRequest): Error | undefined {
    return this.checkWorkspace(request) ?? this.checkPaths(request.paths);
  }
}
