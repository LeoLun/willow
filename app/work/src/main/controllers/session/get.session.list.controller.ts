import { Injectable, IPC } from "@willow/poetry";
import { SessionService } from "@main/service/session.service";
import { IPCBaseController } from "../ipc.base.controller";
import { GetSessionListRequest, GetSessionListResponse } from "@shared/api";

@Injectable()
export class GetSessionListController extends IPCBaseController<
  GetSessionListRequest,
  GetSessionListResponse
> {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  @IPC("GET_SESSION_LIST")
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetSessionListRequest,
  ): Promise<any> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const { workspaceId } = request;

    const data = await this.sessionService.getSessionList(workspaceId);
    return this.buildResponse({ sessions: data });
  }

  checkParams(request: GetSessionListRequest): Error | undefined {
    if (!request || !request.workspaceId) {
      return new Error("workspaceId is required");
    }
    return undefined;
  }
}
