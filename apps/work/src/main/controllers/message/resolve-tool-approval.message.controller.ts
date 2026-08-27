import { MessageService } from "@main/service/message.service";
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
  constructor(private readonly messageService: MessageService) {
    super();
  }

  @IPC(RESOLVE_TOOL_APPROVAL)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: ResolveToolApprovalRequest,
  ): Promise<ApiResponse<ResolveToolApprovalResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    return this.buildResponse({ resolved: await this.messageService.resolveToolApproval(request) });
  }

  checkParams(request: ResolveToolApprovalRequest): Error | undefined {
    if (!request || typeof request.approvalId !== "string" || request.approvalId.trim() === "") {
      return new Error("approvalId must be a non-empty string");
    }
    if (request.decision !== "allow" && request.decision !== "deny") {
      return new Error("decision must be allow or deny");
    }
    return undefined;
  }
}
