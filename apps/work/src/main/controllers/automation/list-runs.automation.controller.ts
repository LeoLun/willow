import { AutomationService } from "@main/service/automation.service";
import type {
  ApiResponse,
  ListAutomationRunsRequest,
  ListAutomationRunsResponse,
} from "@shared/api";
import { LIST_AUTOMATION_RUNS } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { isValidPositiveId } from "./automation-controller.params";

const RUN_HISTORY_MAX_LIMIT = 100;

@Injectable()
export class ListAutomationRunsController extends IPCBaseController<
  ListAutomationRunsRequest,
  ListAutomationRunsResponse
> {
  constructor(private readonly automationService: AutomationService) {
    super();
  }

  @IPC(LIST_AUTOMATION_RUNS)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: ListAutomationRunsRequest,
  ): Promise<ApiResponse<ListAutomationRunsResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    const response = this.automationService.listAutomationRuns(request.automationId, {
      cursor: request.cursor,
      limit: request.limit,
    });
    return this.buildResponse(response);
  }

  checkParams(request: ListAutomationRunsRequest): Error | undefined {
    if (!request || typeof request !== "object") {
      return new Error("request must be an object");
    }
    if (!isValidPositiveId(request.automationId)) {
      return new Error("automationId must be a positive integer");
    }
    if (request.cursor !== undefined && !isValidPositiveId(request.cursor)) {
      return new Error("cursor must be a positive integer");
    }
    if (
      request.limit !== undefined &&
      (!Number.isInteger(request.limit) ||
        (request.limit as number) < 1 ||
        (request.limit as number) > RUN_HISTORY_MAX_LIMIT)
    ) {
      return new Error("limit must be an integer between 1 and 100");
    }
    return undefined;
  }
}
