import { UpdateService } from "@main/service/update.service";
import type { ApiResponse, InstallUpdateResponse } from "@shared/api";
import { INSTALL_UPDATE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class InstallUpdateController extends IPCBaseController<void, InstallUpdateResponse> {
  constructor(private readonly updateService: UpdateService) {
    super();
  }

  @IPC(INSTALL_UPDATE)
  async run(_event: Electron.IpcMainInvokeEvent): Promise<ApiResponse<InstallUpdateResponse>> {
    try {
      const response = await this.updateService.installUpdate();
      return this.buildResponse(response);
    } catch (e) {
      return this.buildError(500, e instanceof Error ? e.message : String(e));
    }
  }

  checkParams(): Error | undefined {
    return undefined;
  }
}
