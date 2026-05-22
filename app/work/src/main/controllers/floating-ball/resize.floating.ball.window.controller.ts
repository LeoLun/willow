import { FloatingBallService } from "@main/service/floating-ball.service";
import type {
  ApiResponse,
  ResizeFloatingBallWindowRequest,
  ResizeFloatingBallWindowResponse,
} from "@shared/api";
import { RESIZE_FLOATING_BALL_WINDOW } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class ResizeFloatingBallWindowController extends IPCBaseController<
  ResizeFloatingBallWindowRequest,
  ResizeFloatingBallWindowResponse
> {
  constructor(private readonly floatingBallService: FloatingBallService) {
    super();
  }

  @IPC(RESIZE_FLOATING_BALL_WINDOW)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: ResizeFloatingBallWindowRequest,
  ): Promise<ApiResponse<ResizeFloatingBallWindowResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const pos = this.floatingBallService.resizeWindow(
      request.width,
      request.height,
      request.focusable,
      request.isLeft,
    );
    if (!pos) {
      return this.buildError(500, "Failed to resize floating ball window");
    }
    return this.buildResponse(pos);
  }

  checkParams(request: ResizeFloatingBallWindowRequest): Error | undefined {
    if (!request || typeof request.width !== "number" || typeof request.height !== "number") {
      return new Error("width and height must be numbers");
    }
    return undefined;
  }
}
