import { TavilyService } from "@main/service/tavily.service";
import type { AddTavilyKeyRequest, AddTavilyKeyResponse, ApiResponse } from "@shared/api";
import { ADD_TAVILY_KEY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class AddTavilyKeyController extends IPCBaseController<
  AddTavilyKeyRequest,
  AddTavilyKeyResponse
> {
  constructor(private readonly tavilyService: TavilyService) {
    super();
  }

  @IPC(ADD_TAVILY_KEY)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: AddTavilyKeyRequest,
  ): Promise<ApiResponse<AddTavilyKeyResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }
    try {
      const key = this.tavilyService.add(request.apiKey, request.monthlyLimit);
      return this.buildResponse({ key });
    } catch (e) {
      return this.buildError(500, e instanceof Error ? e.message : String(e));
    }
  }

  checkParams(request: AddTavilyKeyRequest): Error | undefined {
    if (!request?.apiKey) return new Error("apiKey is required");
    return undefined;
  }
}
