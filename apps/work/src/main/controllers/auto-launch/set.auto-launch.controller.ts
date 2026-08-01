import { AutoLaunchService } from "@main/service/auto-launch.service";
import type { ApiResponse, SetAutoLaunchRequest, SetAutoLaunchResponse } from "@shared/api";
import { SET_AUTO_LAUNCH } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class SetAutoLaunchController extends IPCBaseController<
  SetAutoLaunchRequest,
  SetAutoLaunchResponse
> {
  constructor(private readonly autoLaunchService: AutoLaunchService) {
    super();
  }

  @IPC(SET_AUTO_LAUNCH)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SetAutoLaunchRequest,
  ): Promise<ApiResponse<SetAutoLaunchResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    return this.buildResponse(await this.autoLaunchService.setEnabled(request.enabled));
  }

  checkParams(request: SetAutoLaunchRequest): Error | undefined {
    if (!request || typeof request !== "object") return new Error("request must be an object");
    if (typeof request.enabled !== "boolean") return new Error("enabled must be a boolean");
    return undefined;
  }
}
