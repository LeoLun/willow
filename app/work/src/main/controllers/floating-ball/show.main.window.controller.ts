import { FloatingBallService } from "@main/service/floating-ball.service";
import type { ApiResponse } from "@shared/api";
import { SHOW_MAIN_WINDOW } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class ShowMainWindowController extends IPCBaseController<void, void> {
  constructor(private readonly floatingBallService: FloatingBallService) {
    super();
  }

  @IPC(SHOW_MAIN_WINDOW)
  async run(): Promise<ApiResponse<void>> {
    this.floatingBallService.showMainWindow();
    return this.buildResponse(undefined);
  }

  checkParams(_request: void): Error | undefined {
    return undefined;
  }
}
