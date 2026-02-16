import { Injectable, IPC } from "poetry";
import { dialog } from "electron";
import { SELECT_DIRECTORY } from "@shared/constants";
import type { ISelectDirectoryResult } from "@shared/index";

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
}
