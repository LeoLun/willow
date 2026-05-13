import { ConfigService } from "@main/service/config.service";
import type { ApiResponse, SetDeepSeekApiKeyRequest, SetDeepSeekApiKeyResponse } from "@shared/api";
import { SET_DEEPSEEK_API_KEY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class SetDeepSeekApiKeyController extends IPCBaseController<
  SetDeepSeekApiKeyRequest,
  SetDeepSeekApiKeyResponse
> {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  @IPC(SET_DEEPSEEK_API_KEY)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SetDeepSeekApiKeyRequest,
  ): Promise<ApiResponse<SetDeepSeekApiKeyResponse>> {
    try {
      if (request?.apiKey) {
        const models = this.configService.upsertBuiltinModels(request.apiKey);
        return this.buildResponse({ models });
      } else {
        this.configService.clearBuiltinModels();
        return this.buildResponse({ models: [] });
      }
    } catch (e) {
      return this.buildError(500, e instanceof Error ? e.message : String(e));
    }
  }

  checkParams(): Error | undefined {
    return undefined;
  }
}
