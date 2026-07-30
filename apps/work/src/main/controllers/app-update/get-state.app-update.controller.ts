import { AppUpdateService } from "@main/service/app-update.service";
import type { ApiResponse, AppUpdateRequest, AppUpdateResponse } from "@shared/api";
import { GET_APP_UPDATE_STATE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetAppUpdateStateController extends IPCBaseController<
  AppUpdateRequest,
  AppUpdateResponse
> {
  constructor(private readonly service: AppUpdateService) {
    super();
  }
  @IPC(GET_APP_UPDATE_STATE)
  async run(): Promise<ApiResponse<AppUpdateResponse>> {
    return this.buildResponse(this.service.getState());
  }
  checkParams(): Error | undefined {
    return undefined;
  }
}
