import {
  FileSearchService,
  InvalidWorkspaceFilePathError,
  WorkspaceFileNotFoundError,
} from "@main/service/file-search.service";
import { WorkspaceNotFoundError } from "@main/service/workspace.service";
import type {
  ApiResponse,
  ListWorkspaceDirectoryRequest,
  ListWorkspaceDirectoryResponse,
} from "@shared/api";
import { LIST_WORKSPACE_DIRECTORY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "../workspace/workspace-controller.params";

const MAX_DIRECTORY_PAGE_SIZE = 200;
const MAX_PATH_LENGTH = 4_096;

@Injectable()
export class ListWorkspaceDirectoryController extends IPCBaseController<
  ListWorkspaceDirectoryRequest,
  ListWorkspaceDirectoryResponse
> {
  constructor(private readonly fileSearchService: FileSearchService) {
    super();
  }

  @IPC(LIST_WORKSPACE_DIRECTORY)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: ListWorkspaceDirectoryRequest,
  ): Promise<ApiResponse<ListWorkspaceDirectoryResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      return this.buildResponse(
        await this.fileSearchService.listDirectory(
          request.workspaceId,
          request.directoryPath,
          request.cursor,
          request.limit,
        ),
      );
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError || error instanceof WorkspaceFileNotFoundError) {
        return this.buildError(404, error.message);
      }
      if (error instanceof InvalidWorkspaceFilePathError) {
        return this.buildError(400, error.message);
      }
      throw error;
    }
  }

  checkParams(request: ListWorkspaceDirectoryRequest): Error | undefined {
    const workspaceError = checkWorkspaceId(request);
    if (workspaceError) return workspaceError;
    if (typeof request.directoryPath !== "string")
      return new Error("directoryPath must be a string");
    if (request.directoryPath.length > MAX_PATH_LENGTH) {
      return new Error(`directoryPath must not exceed ${MAX_PATH_LENGTH} characters`);
    }
    if (request.cursor !== undefined && typeof request.cursor !== "string") {
      return new Error("cursor must be a string");
    }
    if (
      request.limit !== undefined &&
      (!Number.isInteger(request.limit) ||
        request.limit <= 0 ||
        request.limit > MAX_DIRECTORY_PAGE_SIZE)
    ) {
      return new Error(`limit must be an integer between 1 and ${MAX_DIRECTORY_PAGE_SIZE}`);
    }
    return undefined;
  }
}
