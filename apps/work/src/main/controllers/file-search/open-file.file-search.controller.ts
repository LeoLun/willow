import {
  FileSearchService,
  InvalidWorkspaceFilePathError,
  WorkspaceFileNotFoundError,
} from "@main/service/file-search.service";
import { WorkspaceNotFoundError } from "@main/service/workspace.service";
import type { ApiResponse, OpenWorkspaceFileRequest, OpenWorkspaceFileResponse } from "@shared/api";
import { OPEN_WORKSPACE_FILE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { shell } from "electron";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "../workspace/workspace-controller.params";

const MAX_PATH_LENGTH = 4_096;

@Injectable()
export class OpenWorkspaceFileController extends IPCBaseController<
  OpenWorkspaceFileRequest,
  OpenWorkspaceFileResponse
> {
  constructor(private readonly fileSearchService: FileSearchService) {
    super();
  }

  @IPC(OPEN_WORKSPACE_FILE)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: OpenWorkspaceFileRequest,
  ): Promise<ApiResponse<OpenWorkspaceFileResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      const filePath = await this.fileSearchService.resolveWorkspaceFilePath(
        request.workspaceId,
        request.relativePath,
      );
      const openError = await shell.openPath(filePath);
      if (openError) throw new Error(openError);
      return this.buildResponse({});
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

  checkParams(request: OpenWorkspaceFileRequest): Error | undefined {
    const workspaceError = checkWorkspaceId(request);
    if (workspaceError) return workspaceError;
    if (typeof request.relativePath !== "string" || request.relativePath.length === 0) {
      return new Error("relativePath must be a non-empty string");
    }
    if (request.relativePath.length > MAX_PATH_LENGTH) {
      return new Error(`relativePath must not exceed ${MAX_PATH_LENGTH} characters`);
    }
    return undefined;
  }
}
