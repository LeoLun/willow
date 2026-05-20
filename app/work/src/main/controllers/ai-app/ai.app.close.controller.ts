import { AiAppViewService } from "@main/service/ai-app-view.service";
import type { ApiResponse } from "@shared/api";
import { AI_APP_CLOSE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class AiAppCloseController extends IPCBaseController<void, void> {
  constructor(private readonly aiAppViewService: AiAppViewService) {
    super();
  }

  @IPC(AI_APP_CLOSE)
  async run(): Promise<ApiResponse<void>> {
    this.aiAppViewService.hideView();
    return this.buildResponse(undefined);
  }

  checkParams(_request: void): Error | undefined {
    return undefined;
  }
}
