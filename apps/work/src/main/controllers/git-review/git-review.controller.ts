import { GitReviewCommandError, InvalidGitReviewPathError } from "@main/service/git-review.service";
import { WorkspaceNotFoundError } from "@main/service/workspace.service";
import type { ApiResponse } from "@shared/api";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "../workspace/workspace-controller.params";

const MAX_PATHS = 10_000;
const MAX_PATH_LENGTH = 4_096;

export abstract class GitReviewController<
  T extends { workspaceId: number },
  K,
> extends IPCBaseController<T, K> {
  protected checkWorkspace(request: T | undefined): Error | undefined {
    return checkWorkspaceId(request);
  }

  protected checkPath(path: unknown, field = "path"): Error | undefined {
    if (typeof path !== "string" || path.length === 0) {
      return new Error(`${field} must be a non-empty string`);
    }
    if (path.length > MAX_PATH_LENGTH) {
      return new Error(`${field} must not exceed ${MAX_PATH_LENGTH} characters`);
    }
    if (path.includes("\0") || path.includes("\r") || path.includes("\n")) {
      return new Error(`${field} contains invalid characters`);
    }
    return undefined;
  }

  protected checkPaths(paths: unknown): Error | undefined {
    if (paths === undefined) return undefined;
    if (!Array.isArray(paths)) return new Error("paths must be an array");
    if (paths.length === 0) return new Error("paths must not be empty");
    if (paths.length > MAX_PATHS)
      return new Error(`paths must not contain more than ${MAX_PATHS} items`);
    for (const path of paths) {
      const error = this.checkPath(path, "paths item");
      if (error) return error;
    }
    return undefined;
  }

  protected mapError(error: unknown): ApiResponse<K> | undefined {
    if (error instanceof WorkspaceNotFoundError) return this.buildError(404, "Workspace not found");
    if (error instanceof InvalidGitReviewPathError) return this.buildError(400, error.message);
    if (error instanceof GitReviewCommandError) return this.buildError(409, error.message);
    return undefined;
  }
}
