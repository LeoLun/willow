import { UpdateService } from "@main/service/update.service";
import type { ApiResponse, StartDownloadResponse } from "@shared/api";
import { START_DOWNLOAD } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class StartDownloadController extends IPCBaseController<void, StartDownloadResponse> {
  constructor(private readonly updateService: UpdateService) {
    super();
  }

  @IPC(START_DOWNLOAD)
  async run(_event: Electron.IpcMainInvokeEvent): Promise<ApiResponse<StartDownloadResponse>> {
    try {
      const response = await this.updateService.startDownload();
      return this.buildResponse(response);
    } catch (e) {
      return this.buildError(500, e instanceof Error ? e.message : String(e));
    }
  }

  checkParams(): Error | undefined {
    return undefined;
  }
}
