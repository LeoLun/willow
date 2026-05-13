import { AutomationService } from "@main/service/automation.service";
import type { ApiResponse, DeleteAutomationRequest, DeleteAutomationResponse } from "@shared/api";
import { DELETE_AUTOMATION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

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
    if (error) {
      return this.buildError(400, error.message);
    }

    const automation = this.automationService.deleteAutomation(request.id);
    return this.buildResponse({ automation });
  }

  checkParams(request: DeleteAutomationRequest): Error | undefined {
    if (!request?.id) {
      return new Error("id is required");
    }
    return undefined;
  }
}
