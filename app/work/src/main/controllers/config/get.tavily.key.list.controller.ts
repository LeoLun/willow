import { TavilyService } from "@main/service/tavily.service";
import type { ApiResponse, GetTavilyKeyListResponse } from "@shared/api";
import { GET_TAVILY_KEY_LIST } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetTavilyKeyListController extends IPCBaseController<void, GetTavilyKeyListResponse> {
  constructor(private readonly tavilyService: TavilyService) {
    super();
  }

  @IPC(GET_TAVILY_KEY_LIST)
  async run(_event: Electron.IpcMainInvokeEvent): Promise<ApiResponse<GetTavilyKeyListResponse>> {
    try {
      const keys = this.tavilyService.getAll();
      return this.buildResponse({ keys });
    } catch (e) {
      return this.buildError(500, e instanceof Error ? e.message : String(e));
    }
  }

  checkParams(): Error | undefined {
    return undefined;
  }
}
