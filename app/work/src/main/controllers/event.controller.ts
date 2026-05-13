import { EventService } from "@main/service/event.service";
import type { ApiResponse, RegisterEventRequest, RegisterEventResponse } from "@shared/api";
import { REGISTER_EVENT } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "./ipc.base.controller";

@Injectable()
export class EventController extends IPCBaseController<
  RegisterEventRequest,
  RegisterEventResponse
> {
  constructor(private readonly eventService: EventService) {
    super();
  }

  @IPC(REGISTER_EVENT)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: RegisterEventRequest,
  ): Promise<ApiResponse<RegisterEventResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    await this.eventService.registerEvent(_event.sender);
    return this.buildResponse({});
  }

  checkParams(request: RegisterEventRequest): Error | undefined {
    if (request.event && typeof request.event !== "string") {
      return new Error("event must be a string");
    }
    return undefined;
  }
}
