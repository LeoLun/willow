import { AutomationService } from "@main/service/automation.service";
import type { ApiResponse, CreateAutomationRequest, CreateAutomationResponse } from "@shared/api";
import { CREATE_AUTOMATION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

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
    if (error) {
      return this.buildError(400, error.message);
    }

    const automation = this.automationService.createAutomation({
      workspaceId: request.workspaceId,
      prompt: request.prompt,
      status: request.status,
      trigger: {
        type: request.trigger.type,
        cronExpression: request.trigger.schedule.cronExpression,
        timezone: request.trigger.schedule.timezone,
      },
    });

    return this.buildResponse({ automation });
  }

  checkParams(request: CreateAutomationRequest): Error | undefined {
    if (!request?.workspaceId) {
      return new Error("workspaceId is required");
    }
    if (!request.prompt?.trim()) {
      return new Error("prompt is required");
    }
    if (!request.trigger?.type || !request.trigger.schedule?.cronExpression) {
      return new Error("trigger schedule is required");
    }
    return undefined;
  }
}
