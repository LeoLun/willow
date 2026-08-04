import { WorkspaceFileWatcherService } from "@main/service/workspace-file-watcher.service";
import type {
  ApiResponse,
  UnsubscribeWorkspaceFilesRequest,
  UnsubscribeWorkspaceFilesResponse,
} from "@shared/api";
import { UNSUBSCRIBE_WORKSPACE_FILES } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class UnsubscribeWorkspaceFilesController extends IPCBaseController<
  UnsubscribeWorkspaceFilesRequest,
  UnsubscribeWorkspaceFilesResponse
> {
  constructor(private readonly watcherService: WorkspaceFileWatcherService) {
    super();
  }

  @IPC(UNSUBSCRIBE_WORKSPACE_FILES)
  async run(
    event: Electron.IpcMainInvokeEvent,
    request: UnsubscribeWorkspaceFilesRequest,
  ): Promise<ApiResponse<UnsubscribeWorkspaceFilesResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    await this.watcherService.unsubscribe(request.subscriptionId, event.sender);
    return this.buildResponse({});
  }

  checkParams(request: UnsubscribeWorkspaceFilesRequest): Error | undefined {
    if (!request || typeof request.subscriptionId !== "string" || !request.subscriptionId) {
      return new Error("subscriptionId must be a non-empty string");
    }
    return undefined;
  }
}
