import { SessionService } from "@main/service/session.service";
import type { ApiResponse, RenameSessionRequest, RenameSessionResponse } from "@shared/api";
import { RENAME_SESSION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class RenameSessionController extends IPCBaseController<
  RenameSessionRequest,
  RenameSessionResponse
> {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  @IPC(RENAME_SESSION)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: RenameSessionRequest,
  ): Promise<ApiResponse<RenameSessionResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const { id, title } = request;
    const data = await this.sessionService.renameSession(id, title);
    return this.buildResponse({ session: data });
  }

  checkParams(request: RenameSessionRequest): Error | undefined {
    if (!request || !request.id) {
      return new Error("id is required");
    }
    if (!request.title || !request.title.trim()) {
      return new Error("title is required");
    }
    return undefined;
  }
}
