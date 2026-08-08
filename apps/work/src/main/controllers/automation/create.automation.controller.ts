import { AutomationService } from "@main/service/automation.service";
import type { ApiResponse, CreateAutomationRequest, CreateAutomationResponse } from "@shared/api";
import { CREATE_AUTOMATION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { validateCreateAutomationRequest } from "./automation-controller.params";

@Injectable()
export class CreateAutomationController extends IPCBaseController<
  CreateAutomationRequest,
  CreateAutomationResponse
> {
  constructor(private readonly automationService: AutomationService) {
    super();
  }

  @IPC(CREATE_AUTOMATION)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: CreateAutomationRequest,
  ): Promise<ApiResponse<CreateAutomationResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    const automation = this.automationService.createAutomation(request);
    return this.buildResponse({ automation });
  }

  checkParams(request: CreateAutomationRequest): Error | undefined {
    return validateCreateAutomationRequest(request);
  }
}
