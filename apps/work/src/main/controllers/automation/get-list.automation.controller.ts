import { AutomationService } from "@main/service/automation.service";
import type { ApiResponse, ListAutomationsRequest, ListAutomationsResponse } from "@shared/api";
import { GET_AUTOMATION_LIST } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetAutomationListController extends IPCBaseController<
  ListAutomationsRequest,
  ListAutomationsResponse
> {
  constructor(private readonly automationService: AutomationService) {
    super();
  }

  @IPC(GET_AUTOMATION_LIST)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: ListAutomationsRequest,
  ): Promise<ApiResponse<ListAutomationsResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    const automations = this.automationService.listAutomations();
    return this.buildResponse({ automations });
  }

  checkParams(request: ListAutomationsRequest): Error | undefined {
    if (request !== undefined && request !== null && typeof request !== "object") {
      return new Error("request must be an object");
    }
    return undefined;
  }
}
