import { AppUpdateService } from "@main/service/app-update.service";
import type { ApiResponse, AppUpdateRequest, OpenManualUpdateResponse } from "@shared/api";
import { OPEN_MANUAL_UPDATE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class OpenManualUpdateController extends IPCBaseController<
  AppUpdateRequest,
  OpenManualUpdateResponse
> {
  constructor(private readonly service: AppUpdateService) {
    super();
  }
  @IPC(OPEN_MANUAL_UPDATE)
  async run(): Promise<ApiResponse<OpenManualUpdateResponse>> {
    await this.service.openManualUpdate();
    return this.buildResponse({});
  }
  checkParams(): Error | undefined {
    return undefined;
  }
}
