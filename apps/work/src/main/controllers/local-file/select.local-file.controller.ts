import type { ApiResponse, SelectLocalFilesRequest, SelectLocalFilesResponse } from "@shared/api";
import { SELECT_LOCAL_FILES } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { BrowserWindow, dialog, type OpenDialogOptions } from "electron";
import { LocalFileService } from "../../service/local-file.service";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class SelectLocalFilesController extends IPCBaseController<
  SelectLocalFilesRequest,
  SelectLocalFilesResponse
> {
  constructor(private readonly localFileService: LocalFileService) {
    super();
  }

  @IPC(SELECT_LOCAL_FILES)
  async run(
    event: Electron.IpcMainInvokeEvent,
    _request: SelectLocalFilesRequest,
  ): Promise<ApiResponse<SelectLocalFilesResponse>> {
    const options: OpenDialogOptions = {
      title: "选择本地文件",
      properties: ["openFile", "multiSelections"],
    };
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled) return this.buildResponse({ files: [] });

    return this.buildResponse({ files: await this.localFileService.inspect(result.filePaths) });
  }

  checkParams(_request: SelectLocalFilesRequest): Error | undefined {
    return undefined;
  }
}
