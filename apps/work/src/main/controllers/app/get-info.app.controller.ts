import type { ApiResponse, GetAppInfoRequest, GetAppInfoResponse } from "@shared/api";
import { GET_APP_INFO } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { app } from "electron";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetAppInfoController extends IPCBaseController<GetAppInfoRequest, GetAppInfoResponse> {
  constructor(private readonly appUpdateService: AppUpdateService) {
    super();
  }
  @IPC(GET_APP_INFO)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    _request: GetAppInfoRequest,
  ): Promise<ApiResponse<GetAppInfoResponse>> {
    return this.buildResponse({
      name: app.getName(),
      version: this.appUpdateService.getCurrentVersion(),
    });
  }

  checkParams(_request: GetAppInfoRequest): Error | undefined {
    return undefined;
  }
}
import { AppUpdateService } from "@main/service/app-update.service";
