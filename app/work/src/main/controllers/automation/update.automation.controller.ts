import { AutomationService } from "@main/service/automation.service";
import type { ApiResponse, UpdateAutomationRequest, UpdateAutomationResponse } from "@shared/api";
import { UPDATE_AUTOMATION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

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
    if (error) {
      return this.buildError(400, error.message);
    }

    const automation = this.automationService.updateAutomation(request.id, {
      title: request.title,
      prompt: request.prompt,
      status: request.status,
      trigger: request.trigger
        ? {
            type: request.trigger.type,
            cronExpression: request.trigger.schedule.cronExpression,
            timezone: request.trigger.schedule.timezone,
          }
        : undefined,
    });

    return this.buildResponse({ automation });
  }

  checkParams(request: UpdateAutomationRequest): Error | undefined {
    if (!request?.id) {
      return new Error("id is required");
    }
    if (
      request.title === undefined &&
      request.prompt === undefined &&
      request.status === undefined &&
      request.trigger === undefined
    ) {
      return new Error("at least one field is required");
    }
    if (request.trigger && !request.trigger.schedule?.cronExpression) {
      return new Error("trigger schedule is required");
    }
    return undefined;
  }
}
