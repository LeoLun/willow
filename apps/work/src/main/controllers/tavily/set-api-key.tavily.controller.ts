import { TavilyService } from "@main/service/tavily.service";
import type { ApiResponse, SetTavilyApiKeyRequest, SetTavilyApiKeyResponse } from "@shared/api";
import { SET_TAVILY_API_KEY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class SetTavilyApiKeyController extends IPCBaseController<
  SetTavilyApiKeyRequest,
  SetTavilyApiKeyResponse
> {
  constructor(private readonly tavilyService: TavilyService) {
    super();
  }

  @IPC(SET_TAVILY_API_KEY)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SetTavilyApiKeyRequest,
  ): Promise<ApiResponse<SetTavilyApiKeyResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    return this.buildResponse(await this.tavilyService.setApiKey(request.apiKey));
  }

  checkParams(request: SetTavilyApiKeyRequest): Error | undefined {
    if (!request || typeof request.apiKey !== "string" || request.apiKey.trim() === "") {
      return new Error("apiKey must be a non-empty string");
    }
    return undefined;
  }
}
