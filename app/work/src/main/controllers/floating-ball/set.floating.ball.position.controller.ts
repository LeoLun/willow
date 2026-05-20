import { FloatingBallService } from "@main/service/floating-ball.service";
import type { ApiResponse, SetFloatingBallPositionRequest } from "@shared/api";
import { SET_FLOATING_BALL_POSITION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class SetFloatingBallPositionController extends IPCBaseController<
  SetFloatingBallPositionRequest,
  void
> {
  constructor(private readonly floatingBallService: FloatingBallService) {
    super();
  }

  @IPC(SET_FLOATING_BALL_POSITION)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SetFloatingBallPositionRequest,
  ): Promise<ApiResponse<void>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    await this.floatingBallService.setPosition(request.x, request.y);
    return this.buildResponse(undefined);
  }

  checkParams(request: SetFloatingBallPositionRequest): Error | undefined {
    if (!request || typeof request.x !== "number" || typeof request.y !== "number") {
      return new Error("x and y must be numbers");
    }
    return undefined;
  }
}
