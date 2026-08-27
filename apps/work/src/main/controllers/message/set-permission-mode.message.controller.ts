import { PermissionModeService } from "@main/service/permission-mode.service";
import type { ApiResponse, SetPermissionModeRequest, SetPermissionModeResponse } from "@shared/api";
import { SET_PERMISSION_MODE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkMessageSessionParams } from "./message-controller.params";

@Injectable()
export class SetPermissionModeController extends IPCBaseController<
  SetPermissionModeRequest,
  SetPermissionModeResponse
> {
  constructor(private readonly permissionModeService: PermissionModeService) {
    super();
  }

  @IPC(SET_PERMISSION_MODE)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SetPermissionModeRequest,
  ): Promise<ApiResponse<SetPermissionModeResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    this.permissionModeService.set(request.workspaceId, request.sessionId, request.permissionMode);
    return this.buildResponse({ permissionMode: request.permissionMode });
  }

  checkParams(request: SetPermissionModeRequest): Error | undefined {
    const sessionError = checkMessageSessionParams(request);
    if (sessionError) return sessionError;
    if (
      request.permissionMode !== "request-approval" &&
      request.permissionMode !== "delegate-approval" &&
      request.permissionMode !== "full-access"
    ) {
      return new Error("permissionMode must be a supported permission mode");
    }
    return undefined;
  }
}
