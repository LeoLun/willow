import type {
  CommitGitChangesRequest,
  CommitGitChangesResponse,
  GetGitReviewDiffRequest,
  GetGitReviewDiffResponse,
  GetGitReviewStatusRequest,
  GetGitReviewStatusResponse,
  UpdateGitReviewIndexRequest,
  UpdateGitReviewIndexResponse,
} from "../api";

export interface IGitReviewApi {
  commitGitChanges(request: CommitGitChangesRequest): Promise<CommitGitChangesResponse>;
  getGitReviewDiff(request: GetGitReviewDiffRequest): Promise<GetGitReviewDiffResponse>;
  getGitReviewStatus(request: GetGitReviewStatusRequest): Promise<GetGitReviewStatusResponse>;
  stageGitChanges(request: UpdateGitReviewIndexRequest): Promise<UpdateGitReviewIndexResponse>;
  unstageGitChanges(request: UpdateGitReviewIndexRequest): Promise<UpdateGitReviewIndexResponse>;
}
