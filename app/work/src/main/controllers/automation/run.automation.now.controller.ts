import { AutomationService } from "@main/service/automation.service";
import type { ApiResponse, RunAutomationNowRequest, RunAutomationNowResponse } from "@shared/api";
import { RUN_AUTOMATION_NOW } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class RunAutomationNowController extends IPCBaseController<
  RunAutomationNowRequest,
  RunAutomationNowResponse
> {
  constructor(private readonly automationService: AutomationService) {
    super();
  }

  @IPC(RUN_AUTOMATION_NOW)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: RunAutomationNowRequest,
  ): Promise<ApiResponse<RunAutomationNowResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const result = await this.automationService.runAutomationNow(request.id);
    return this.buildResponse(result);
  }

  checkParams(request: RunAutomationNowRequest): Error | undefined {
    if (!request?.id) {
      return new Error("id is required");
    }
    return undefined;
  }
}
