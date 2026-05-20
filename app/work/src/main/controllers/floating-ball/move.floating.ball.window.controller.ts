import { FloatingBallService } from "@main/service/floating-ball.service";
import type { ApiResponse, MoveFloatingBallWindowRequest } from "@shared/api";
import { MOVE_FLOATING_BALL_WINDOW } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class MoveFloatingBallWindowController extends IPCBaseController<
  MoveFloatingBallWindowRequest,
  void
> {
  constructor(private readonly floatingBallService: FloatingBallService) {
    super();
  }

  @IPC(MOVE_FLOATING_BALL_WINDOW)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: MoveFloatingBallWindowRequest,
  ): Promise<ApiResponse<void>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    this.floatingBallService.moveWindow(request.x, request.y);
    return this.buildResponse(undefined);
  }

  checkParams(request: MoveFloatingBallWindowRequest): Error | undefined {
    if (!request || typeof request.x !== "number" || typeof request.y !== "number") {
      return new Error("x and y must be numbers");
    }
    return undefined;
  }
}
