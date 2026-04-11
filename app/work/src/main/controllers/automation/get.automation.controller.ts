import { AutomationService } from "@main/service/automation.service";
import type { ApiResponse, GetAutomationRequest, GetAutomationResponse } from "@shared/api";
import { GET_AUTOMATION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetAutomationController extends IPCBaseController<
  GetAutomationRequest,
  GetAutomationResponse
> {
  constructor(private readonly automationService: AutomationService) {
    super();
  }

  @IPC(GET_AUTOMATION)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetAutomationRequest,
  ): Promise<ApiResponse<GetAutomationResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const automation = this.automationService.getAutomation(request.id);
    return this.buildResponse({ automation });
  }

  checkParams(request: GetAutomationRequest): Error | undefined {
    if (!request?.id) {
      return new Error("id is required");
    }
    return undefined;
  }
}
