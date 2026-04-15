import type { ApiResponse, OpenPathRequest, OpenPathResponse } from "@shared/api";
import { OPEN_PATH, SELECT_DIRECTORY } from "@shared/constants";
import type { ISelectDirectoryResult } from "@shared/index";
import { Injectable, IPC } from "@willow/poetry";
import { dialog, shell } from "electron";

@Injectable()
export class DialogController {
  @IPC(SELECT_DIRECTORY)
  async selectDirectory(
    _event: Electron.IpcMainInvokeEvent,
    defaultPath?: string,
  ): Promise<ISelectDirectoryResult> {
    const result = await dialog.showOpenDialog({
      title: "选择操作目录",
      defaultPath,
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { selected: false };
    }

    return { selected: true, path: result.filePaths[0] };
  }

  @IPC(OPEN_PATH)
  async openPath(
    _event: Electron.IpcMainInvokeEvent,
    request: OpenPathRequest,
  ): Promise<ApiResponse<OpenPathResponse>> {
    if (!request?.path?.trim()) {
      return {
        code: 400,
        msg: "path is required",
      };
    }

    const errorMessage = await shell.openPath(request.path);
    if (errorMessage) {
      return {
        code: 400,
        msg: errorMessage,
      };
    }

    return {
      code: 0,
      msg: "ok",
      data: {},
    };
  }
}
