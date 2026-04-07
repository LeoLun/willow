import { ConfigService } from "@main/service/config.service";
import type { ApiResponse, GetModelListResponse } from "@shared/api";
import { GET_MODEL_LIST } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetModelListController extends IPCBaseController<void, GetModelListResponse> {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  @IPC(GET_MODEL_LIST)
  async run(_event: Electron.IpcMainInvokeEvent): Promise<ApiResponse<GetModelListResponse>> {
    try {
      const models = this.configService.getModelList();
      return this.buildResponse({ models });
    } catch (e) {
      return this.buildError(500, e instanceof Error ? e.message : String(e));
    }
  }

  checkParams(): Error | undefined {
    return undefined;
  }
}
