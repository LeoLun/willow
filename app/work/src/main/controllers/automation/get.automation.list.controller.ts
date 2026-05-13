import { AutomationService } from "@main/service/automation.service";
import type { ApiResponse, GetAutomationListResponse } from "@shared/api";
import { GET_AUTOMATION_LIST } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetAutomationListController extends IPCBaseController<
  void,
  GetAutomationListResponse
> {
  constructor(private readonly automationService: AutomationService) {
    super();
  }

  @IPC(GET_AUTOMATION_LIST)
  async run(): Promise<ApiResponse<GetAutomationListResponse>> {
    const automations = this.automationService.listAutomations();
    return this.buildResponse({ automations });
  }

  checkParams(): Error | undefined {
    return undefined;
  }
}
