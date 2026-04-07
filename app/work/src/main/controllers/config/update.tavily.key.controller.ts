import { TavilyService } from "@main/service/tavily.service";
import type { ApiResponse, UpdateTavilyKeyRequest, UpdateTavilyKeyResponse } from "@shared/api";
import { UPDATE_TAVILY_KEY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class UpdateTavilyKeyController extends IPCBaseController<
  UpdateTavilyKeyRequest,
  UpdateTavilyKeyResponse
> {
  constructor(private readonly tavilyService: TavilyService) {
    super();
  }

  @IPC(UPDATE_TAVILY_KEY)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: UpdateTavilyKeyRequest,
  ): Promise<ApiResponse<UpdateTavilyKeyResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }
    try {
      const key = this.tavilyService.update(request.id, {
        apiKey: request.apiKey,
        monthlyLimit: request.monthlyLimit,
      });
      if (!key) {
        return this.buildError(404, "Tavily key not found");
      }
      return this.buildResponse({ key });
    } catch (e) {
      return this.buildError(500, e instanceof Error ? e.message : String(e));
    }
  }

  checkParams(request: UpdateTavilyKeyRequest): Error | undefined {
    if (!request?.id) return new Error("id is required");
    return undefined;
  }
}
