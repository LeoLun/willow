import {
  AutomationRunningConflictError,
  AutomationService,
} from "@main/service/automation.service";
import type { ApiResponse, DeleteAutomationRequest, DeleteAutomationResponse } from "@shared/api";
import { DELETE_AUTOMATION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { isValidPositiveId } from "./automation-controller.params";

@Injectable()
export class DeleteAutomationController extends IPCBaseController<
  DeleteAutomationRequest,
  DeleteAutomationResponse
> {
  constructor(private readonly automationService: AutomationService) {
    super();
  }

  @IPC(DELETE_AUTOMATION)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: DeleteAutomationRequest,
  ): Promise<ApiResponse<DeleteAutomationResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      this.automationService.deleteAutomation(request.id);
      return this.buildResponse({});
    } catch (exception) {
      if (exception instanceof AutomationRunningConflictError) {
        return this.buildError(409, exception.message);
      }
      throw exception;
    }
  }

  checkParams(request: DeleteAutomationRequest): Error | undefined {
    if (!request || typeof request !== "object" || !isValidPositiveId(request.id)) {
      return new Error("id must be a positive integer");
    }
    return undefined;
  }
}
