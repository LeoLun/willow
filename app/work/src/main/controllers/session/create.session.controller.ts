import { Injectable, IPC } from "@willow/poetry";
import { SessionService } from "@main/service/session.service";
import { IPCBaseController } from "../ipc.base.controller";

interface CreateSessionRequest {
  workspaceId: string;
}

@Injectable()
export class CreateSessionController extends IPCBaseController<
  CreateSessionRequest,
  any
> {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  @IPC("CREATE_SESSION")
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: CreateSessionRequest,
  ): Promise<any> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const { workspaceId } = request;

    const data = await this.sessionService.createSession(workspaceId);
    return this.buildResponse(data);
  }

  checkParams(request: CreateSessionRequest): Error | undefined {
    if (!request || !request.workspaceId) {
      return new Error("workspaceId is required");
    }
    return undefined;
  }
}
