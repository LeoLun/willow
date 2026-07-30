import { AppUpdateService } from "@main/service/app-update.service";
import type { ApiResponse, AppUpdateRequest, RestartToUpdateResponse } from "@shared/api";
import { RESTART_TO_UPDATE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class RestartToUpdateController extends IPCBaseController<
  AppUpdateRequest,
  RestartToUpdateResponse
> {
  constructor(private readonly service: AppUpdateService) {
    super();
  }
  @IPC(RESTART_TO_UPDATE)
  async run(): Promise<ApiResponse<RestartToUpdateResponse>> {
    await this.service.restartToUpdate();
    return this.buildResponse({});
  }
  checkParams(): Error | undefined {
    return undefined;
  }
}
