import { TavilyService } from "@main/service/tavily.service";
import type {
  ApiResponse,
  DeleteTavilyApiKeyRequest,
  DeleteTavilyApiKeyResponse,
} from "@shared/api";
import { DELETE_TAVILY_API_KEY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class DeleteTavilyApiKeyController extends IPCBaseController<
  DeleteTavilyApiKeyRequest,
  DeleteTavilyApiKeyResponse
> {
  constructor(private readonly tavilyService: TavilyService) {
    super();
  }

  @IPC(DELETE_TAVILY_API_KEY)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: DeleteTavilyApiKeyRequest,
  ): Promise<ApiResponse<DeleteTavilyApiKeyResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    await this.tavilyService.deleteApiKey();
    return this.buildResponse({});
  }

  checkParams(_request: DeleteTavilyApiKeyRequest): Error | undefined {
    return undefined;
  }
}
