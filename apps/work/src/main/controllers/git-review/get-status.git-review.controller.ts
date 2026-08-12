import { GitReviewService } from "@main/service/git-review.service";
import type {
  ApiResponse,
  GetGitReviewStatusRequest,
  GetGitReviewStatusResponse,
} from "@shared/api";
import { GET_GIT_REVIEW_STATUS } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { GitReviewController } from "./git-review.controller";

@Injectable()
export class GetGitReviewStatusController extends GitReviewController<
  GetGitReviewStatusRequest,
  GetGitReviewStatusResponse
> {
  constructor(private readonly gitReviewService: GitReviewService) {
    super();
  }

  @IPC(GET_GIT_REVIEW_STATUS)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetGitReviewStatusRequest,
  ): Promise<ApiResponse<GetGitReviewStatusResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    try {
      return this.buildResponse({
        review: await this.gitReviewService.getStatus(request.workspaceId),
      });
    } catch (error) {
      const response = this.mapError(error);
      if (response) return response;
      throw error;
    }
  }

  checkParams(request: GetGitReviewStatusRequest): Error | undefined {
    return this.checkWorkspace(request);
  }
}
