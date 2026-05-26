import { WorkspaceService } from "@main/service/workspace.service";
import type { ApiResponse, ReadFileRequest, ReadFileResponse } from "@shared/api";
import { READ_FILE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class ReadFileController extends IPCBaseController<ReadFileRequest, ReadFileResponse> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(READ_FILE)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: ReadFileRequest,
  ): Promise<ApiResponse<ReadFileResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    try {
      const content = await this.workspaceService.readWorkspaceFile(
        request.workspaceId,
        request.path,
      );
      return this.buildResponse({ content });
    } catch (error) {
      return this.buildError(
        400,
        error instanceof Error ? error.message : "read workspace file failed",
      );
    }
  }

  checkParams(request: ReadFileRequest): Error | undefined {
    if (!request?.workspaceId) {
      return new Error("workspaceId is required");
    }
    if (!request?.path) {
      return new Error("path is required");
    }
    return undefined;
  }
}
