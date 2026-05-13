import { stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import type {
  ApiResponse,
  OpenPathRequest,
  OpenPathResponse,
  SelectedSystemFile,
  SelectFilesRequest,
  SelectFilesResponse,
} from "@shared/api";
import { OPEN_PATH, SELECT_DIRECTORY, SELECT_FILES } from "@shared/constants";
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

  @IPC(SELECT_FILES)
  async selectFiles(
    _event: Electron.IpcMainInvokeEvent,
    request?: SelectFilesRequest,
  ): Promise<ApiResponse<SelectFilesResponse>> {
    const result = await dialog.showOpenDialog({
      title: "选择文件",
      defaultPath: request?.defaultPath,
      properties:
        request?.multiSelections === false ? ["openFile"] : ["openFile", "multiSelections"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return {
        code: 0,
        msg: "ok",
        data: {
          selected: false,
          files: [],
        },
      };
    }

    const files = await Promise.all(
      result.filePaths.map((filePath) => this.toSelectedFile(filePath)),
    );

    return {
      code: 0,
      msg: "ok",
      data: {
        selected: true,
        files,
      },
    };
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

  private async toSelectedFile(filePath: string): Promise<SelectedSystemFile> {
    const file: SelectedSystemFile = {
      name: basename(filePath),
      path: filePath,
      extension: extname(filePath).replace(/^\./, "") || undefined,
    };

    try {
      const info = await stat(filePath);
      file.size = info.size;
    } catch {
      // Size is helpful metadata, but selection should not fail if stat is unavailable.
    }

    return file;
  }
}
