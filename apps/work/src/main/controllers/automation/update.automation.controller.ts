import { AutomationService } from "@main/service/automation.service";
import type { ApiResponse, UpdateAutomationRequest, UpdateAutomationResponse } from "@shared/api";
import { UPDATE_AUTOMATION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { validateUpdateAutomationRequest } from "./automation-controller.params";

@Injectable()
export class UpdateAutomationController extends IPCBaseController<
  UpdateAutomationRequest,
  UpdateAutomationResponse
> {
  constructor(private readonly automationService: AutomationService) {
    super();
  }

  @IPC(UPDATE_AUTOMATION)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: UpdateAutomationRequest,
  ): Promise<ApiResponse<UpdateAutomationResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    const automation = this.automationService.updateAutomation(request);
    return this.buildResponse({ automation });
  }

  checkParams(request: UpdateAutomationRequest): Error | undefined {
    return validateUpdateAutomationRequest(request);
  }
}
