import { FloatingBallService } from "@main/service/floating-ball.service";
import type { ApiResponse, GetFloatingBallConfigResponse } from "@shared/api";
import { GET_FLOATING_BALL_CONFIG } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetFloatingBallConfigController extends IPCBaseController<
  void,
  GetFloatingBallConfigResponse
> {
  constructor(private readonly floatingBallService: FloatingBallService) {
    super();
  }

  @IPC(GET_FLOATING_BALL_CONFIG)
  async run(): Promise<ApiResponse<GetFloatingBallConfigResponse>> {
    const config = this.floatingBallService.getConfig();
    return this.buildResponse({ config });
  }

  checkParams(_request: void): Error | undefined {
    return undefined;
  }
}
