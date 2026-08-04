import {
  FileSearchService,
  InvalidWorkspaceFilePathError,
  WorkspaceFileNotFoundError,
} from "@main/service/file-search.service";
import { WorkspaceNotFoundError } from "@main/service/workspace.service";
import type {
  ApiResponse,
  RevealWorkspaceEntryRequest,
  RevealWorkspaceEntryResponse,
} from "@shared/api";
import { REVEAL_WORKSPACE_ENTRY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { shell } from "electron";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "../workspace/workspace-controller.params";

const MAX_PATH_LENGTH = 4_096;

@Injectable()
export class RevealWorkspaceEntryController extends IPCBaseController<
  RevealWorkspaceEntryRequest,
  RevealWorkspaceEntryResponse
> {
  constructor(private readonly fileSearchService: FileSearchService) {
    super();
  }

  @IPC(REVEAL_WORKSPACE_ENTRY)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: RevealWorkspaceEntryRequest,
  ): Promise<ApiResponse<RevealWorkspaceEntryResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      const entryPath = await this.fileSearchService.resolveWorkspaceEntryPath(
        request.workspaceId,
        request.relativePath,
      );
      shell.showItemInFolder(entryPath);
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

  checkParams(request: RevealWorkspaceEntryRequest): Error | undefined {
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
