import { UserConfigService } from "@main/service/user-config.service";
import type { ApiResponse, GetUserConfigRequest, GetUserConfigResponse } from "@shared/api";
import { GET_USER_CONFIG } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetUserConfigController extends IPCBaseController<
  GetUserConfigRequest,
  GetUserConfigResponse
> {
  constructor(private readonly userConfigService: UserConfigService) {
    super();
  }

  @IPC(GET_USER_CONFIG)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    _request: GetUserConfigRequest,
  ): Promise<ApiResponse<GetUserConfigResponse>> {
    return this.buildResponse(this.userConfigService.getConfig());
  }

  checkParams(_request: GetUserConfigRequest): Error | undefined {
    return undefined;
  }
}
