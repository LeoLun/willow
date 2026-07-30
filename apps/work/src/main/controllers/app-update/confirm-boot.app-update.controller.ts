import { AppUpdateService } from "@main/service/app-update.service";
import type { ApiResponse, AppUpdateRequest, AppUpdateResponse } from "@shared/api";
import { CONFIRM_UPDATE_BOOT } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class ConfirmUpdateBootController extends IPCBaseController<
  AppUpdateRequest,
  AppUpdateResponse
> {
  constructor(private readonly service: AppUpdateService) {
    super();
  }
  @IPC(CONFIRM_UPDATE_BOOT)
  async run(): Promise<ApiResponse<AppUpdateResponse>> {
    return this.buildResponse(await this.service.confirmUpdateBoot());
  }
  checkParams(): Error | undefined {
    return undefined;
  }
}
