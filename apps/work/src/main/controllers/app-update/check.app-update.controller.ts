import { AppUpdateService } from "@main/service/app-update.service";
import type { ApiResponse, AppUpdateRequest, AppUpdateResponse } from "@shared/api";
import { CHECK_APP_UPDATE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class CheckAppUpdateController extends IPCBaseController<
  AppUpdateRequest,
  AppUpdateResponse
> {
  constructor(private readonly service: AppUpdateService) {
    super();
  }
  @IPC(CHECK_APP_UPDATE)
  async run(): Promise<ApiResponse<AppUpdateResponse>> {
    return this.buildResponse(await this.service.checkForUpdate());
  }
  checkParams(): Error | undefined {
    return undefined;
  }
}
