import { SessionService } from "@main/service/session.service";
import type { ApiResponse, DeleteSessionRequest, DeleteSessionResponse } from "@shared/api";
import { DELETE_SESSION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class DeleteSessionController extends IPCBaseController<
  DeleteSessionRequest,
  DeleteSessionResponse
> {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  @IPC(DELETE_SESSION)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: DeleteSessionRequest,
  ): Promise<ApiResponse<DeleteSessionResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const { id } = request;
    const data = await this.sessionService.deleteSession(id);
    if (!data) {
      return this.buildError(400, "session not found");
    }
    return this.buildResponse({ session: data });
  }

  checkParams(request: DeleteSessionRequest): Error | undefined {
    if (!request || !request.id) {
      return new Error("id is required");
    }
    return undefined;
  }
}
