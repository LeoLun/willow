import { basename } from "node:path";
import type {
  ApiResponse,
  SelectWorkspaceDirectoryRequest,
  SelectWorkspaceDirectoryResponse,
} from "@shared/api";
import { SELECT_WORKSPACE_DIRECTORY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { BrowserWindow, dialog, type OpenDialogOptions } from "electron";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class SelectWorkspaceDirectoryController extends IPCBaseController<
  SelectWorkspaceDirectoryRequest,
  SelectWorkspaceDirectoryResponse
> {
  @IPC(SELECT_WORKSPACE_DIRECTORY)
  async run(
    event: Electron.IpcMainInvokeEvent,
    _request: SelectWorkspaceDirectoryRequest,
  ): Promise<ApiResponse<SelectWorkspaceDirectoryResponse>> {
    const options: OpenDialogOptions = {
      title: "选择工作空间文件夹",
      properties: ["openDirectory"],
    };
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || !result.filePaths[0]) {
      return this.buildResponse({ directory: null });
    }

    const path = result.filePaths[0];
    return this.buildResponse({
      directory: { name: basename(path) || path, path },
    });
  }

  checkParams(_request: SelectWorkspaceDirectoryRequest): Error | undefined {
    return undefined;
  }
}
