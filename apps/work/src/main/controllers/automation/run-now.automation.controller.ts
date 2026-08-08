import {
  AutomationRunningConflictError,
  AutomationService,
} from "@main/service/automation.service";
import type { ApiResponse, RunAutomationNowRequest, RunAutomationNowResponse } from "@shared/api";
import { RUN_AUTOMATION_NOW } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { isValidPositiveId } from "./automation-controller.params";

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
    if (error) return this.buildError(400, error.message);

    try {
      const run = await this.automationService.runAutomationNow(request.id);
      return this.buildResponse(run);
    } catch (exception) {
      if (exception instanceof AutomationRunningConflictError) {
        return this.buildError(409, exception.message);
      }
      throw exception;
    }
  }

  checkParams(request: RunAutomationNowRequest): Error | undefined {
    if (!request || typeof request !== "object" || !isValidPositiveId(request.id)) {
      return new Error("id must be a positive integer");
    }
    return undefined;
  }
}
