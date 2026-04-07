import { SessionService } from "@main/service/session.service";
import type {
  ApiResponse,
  ResolveToolApprovalRequest,
  ResolveToolApprovalResponse,
} from "@shared/api";
import { RESOLVE_TOOL_APPROVAL } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class ResolveToolApprovalController extends IPCBaseController<
  ResolveToolApprovalRequest,
  ResolveToolApprovalResponse
> {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  @IPC(RESOLVE_TOOL_APPROVAL)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: ResolveToolApprovalRequest,
  ): Promise<ApiResponse<ResolveToolApprovalResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    await this.sessionService.resolveToolApproval(
      request.sessionId,
      request.toolCallId,
      request.decision,
    );
    return this.buildResponse({});
  }

  checkParams(request: ResolveToolApprovalRequest): Error | undefined {
    if (!request || !request.sessionId) {
      return new Error("sessionId is required");
    }
    if (!request.toolCallId) {
      return new Error("toolCallId is required");
    }
    if (request.decision !== "approved" && request.decision !== "rejected") {
      return new Error("decision is invalid");
    }
    return undefined;
  }
}
