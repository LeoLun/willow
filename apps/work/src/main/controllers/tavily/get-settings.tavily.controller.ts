import { TavilyService } from "@main/service/tavily.service";
import type { ApiResponse, GetTavilySettingsRequest, GetTavilySettingsResponse } from "@shared/api";
import { GET_TAVILY_SETTINGS } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetTavilySettingsController extends IPCBaseController<
  GetTavilySettingsRequest,
  GetTavilySettingsResponse
> {
  constructor(private readonly tavilyService: TavilyService) {
    super();
  }

  @IPC(GET_TAVILY_SETTINGS)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetTavilySettingsRequest,
  ): Promise<ApiResponse<GetTavilySettingsResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    return this.buildResponse(await this.tavilyService.getSettings());
  }

  checkParams(_request: GetTavilySettingsRequest): Error | undefined {
    return undefined;
  }
}
