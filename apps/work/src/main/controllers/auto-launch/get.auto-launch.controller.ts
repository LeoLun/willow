import { AutoLaunchService } from "@main/service/auto-launch.service";
import type { ApiResponse, GetAutoLaunchRequest, GetAutoLaunchResponse } from "@shared/api";
import { GET_AUTO_LAUNCH } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetAutoLaunchController extends IPCBaseController<
  GetAutoLaunchRequest,
  GetAutoLaunchResponse
> {
  constructor(private readonly autoLaunchService: AutoLaunchService) {
    super();
  }

  @IPC(GET_AUTO_LAUNCH)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    _request: GetAutoLaunchRequest,
  ): Promise<ApiResponse<GetAutoLaunchResponse>> {
    return this.buildResponse(await this.autoLaunchService.getState());
  }

  checkParams(_request: GetAutoLaunchRequest): Error | undefined {
    return undefined;
  }
}
