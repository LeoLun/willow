import { UpdateService } from "@main/service/update.service";
import type { ApiResponse, CheckUpdateResponse } from "@shared/api";
import { CHECK_UPDATE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class CheckUpdateController extends IPCBaseController<void, CheckUpdateResponse> {
  constructor(private readonly updateService: UpdateService) {
    super();
  }

  @IPC(CHECK_UPDATE)
  async run(_event: Electron.IpcMainInvokeEvent): Promise<ApiResponse<CheckUpdateResponse>> {
    try {
      const response = await this.updateService.checkUpdate();
      return this.buildResponse(response);
    } catch (e) {
      return this.buildError(500, e instanceof Error ? e.message : String(e));
    }
  }

  checkParams(): Error | undefined {
    return undefined;
  }
}
