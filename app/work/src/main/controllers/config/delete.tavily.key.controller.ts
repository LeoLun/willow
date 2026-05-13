import { TavilyService } from "@main/service/tavily.service";
import type { ApiResponse, DeleteTavilyKeyRequest, DeleteTavilyKeyResponse } from "@shared/api";
import { DELETE_TAVILY_KEY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class DeleteTavilyKeyController extends IPCBaseController<
  DeleteTavilyKeyRequest,
  DeleteTavilyKeyResponse
> {
  constructor(private readonly tavilyService: TavilyService) {
    super();
  }

  @IPC(DELETE_TAVILY_KEY)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: DeleteTavilyKeyRequest,
  ): Promise<ApiResponse<DeleteTavilyKeyResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }
    try {
      const key = this.tavilyService.delete(request.id);
      if (!key) {
        return this.buildError(404, "Tavily key not found");
      }
      return this.buildResponse({ key });
    } catch (e) {
      return this.buildError(500, e instanceof Error ? e.message : String(e));
    }
  }

  checkParams(request: DeleteTavilyKeyRequest): Error | undefined {
    if (!request?.id) return new Error("id is required");
    return undefined;
  }
}
