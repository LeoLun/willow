import { FloatingBallService } from "@main/service/floating-ball.service";
import type { ApiResponse, SetFloatingBallEnabledRequest } from "@shared/api";
import { SET_FLOATING_BALL_ENABLED } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class SetFloatingBallEnabledController extends IPCBaseController<
  SetFloatingBallEnabledRequest,
  void
> {
  constructor(private readonly floatingBallService: FloatingBallService) {
    super();
  }

  @IPC(SET_FLOATING_BALL_ENABLED)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SetFloatingBallEnabledRequest,
  ): Promise<ApiResponse<void>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    await this.floatingBallService.setEnabled(request.enabled);
    return this.buildResponse(undefined);
  }

  checkParams(request: SetFloatingBallEnabledRequest): Error | undefined {
    if (!request || typeof request.enabled !== "boolean") {
      return new Error("enabled must be a boolean");
    }
    return undefined;
  }
}
