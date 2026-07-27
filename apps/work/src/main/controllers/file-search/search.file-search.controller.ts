import { FileSearchService } from "@main/service/file-search.service";
import { WorkspaceNotFoundError } from "@main/service/workspace.service";
import type { ApiResponse, SearchFilesRequest, SearchFilesResponse } from "@shared/api";
import { SEARCH_FILES } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "../workspace/workspace-controller.params";

const MAX_QUERY_LENGTH = 200;

@Injectable()
export class SearchFilesController extends IPCBaseController<
  SearchFilesRequest,
  SearchFilesResponse
> {
  constructor(private readonly fileSearchService: FileSearchService) {
    super();
  }

  @IPC(SEARCH_FILES)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SearchFilesRequest,
  ): Promise<ApiResponse<SearchFilesResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      return this.buildResponse({
        files: await this.fileSearchService.searchFiles(request.workspaceId, request.query),
      });
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        return this.buildError(404, "Workspace not found");
      }
      throw error;
    }
  }

  checkParams(request: SearchFilesRequest): Error | undefined {
    const workspaceError = checkWorkspaceId(request);
    if (workspaceError) return workspaceError;
    if (typeof request.query !== "string") return new Error("query must be a string");
    if (request.query.length > MAX_QUERY_LENGTH) {
      return new Error(`query must not exceed ${MAX_QUERY_LENGTH} characters`);
    }
    return undefined;
  }
}
