import { WorkspaceFileWatcherService } from "@main/service/workspace-file-watcher.service";
import { WorkspaceNotFoundError } from "@main/service/workspace.service";
import type {
  ApiResponse,
  SubscribeWorkspaceFilesRequest,
  SubscribeWorkspaceFilesResponse,
} from "@shared/api";
import { SUBSCRIBE_WORKSPACE_FILES } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "../workspace/workspace-controller.params";

const MAX_SUBSCRIPTION_ID_LENGTH = 200;

@Injectable()
export class SubscribeWorkspaceFilesController extends IPCBaseController<
  SubscribeWorkspaceFilesRequest,
  SubscribeWorkspaceFilesResponse
> {
  constructor(private readonly watcherService: WorkspaceFileWatcherService) {
    super();
  }

  @IPC(SUBSCRIBE_WORKSPACE_FILES)
  async run(
    event: Electron.IpcMainInvokeEvent,
    request: SubscribeWorkspaceFilesRequest,
  ): Promise<ApiResponse<SubscribeWorkspaceFilesResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      await this.watcherService.subscribe(
        request.workspaceId,
        request.subscriptionId,
        event.sender,
      );
      return this.buildResponse({});
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) return this.buildError(404, error.message);
      throw error;
    }
  }

  checkParams(request: SubscribeWorkspaceFilesRequest): Error | undefined {
    const workspaceError = checkWorkspaceId(request);
    if (workspaceError) return workspaceError;
    if (typeof request.subscriptionId !== "string" || request.subscriptionId.length === 0) {
      return new Error("subscriptionId must be a non-empty string");
    }
    if (request.subscriptionId.length > MAX_SUBSCRIPTION_ID_LENGTH) {
      return new Error(`subscriptionId must not exceed ${MAX_SUBSCRIPTION_ID_LENGTH} characters`);
    }
    return undefined;
  }
}
