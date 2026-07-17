import type { ApiResponse, SetThemeRequest, SetThemeResponse, ThemeMode } from "@shared/api";
import { SET_THEME } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { nativeTheme } from "electron";
import { IPCBaseController } from "../ipc.base.controller";

const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark"];

@Injectable()
export class SetThemeController extends IPCBaseController<SetThemeRequest, SetThemeResponse> {
  @IPC(SET_THEME)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SetThemeRequest,
  ): Promise<ApiResponse<SetThemeResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    nativeTheme.themeSource = request.mode;
    return this.buildResponse({});
  }

  checkParams(request: SetThemeRequest): Error | undefined {
    if (!request || typeof request !== "object") {
      return new Error("request must be an object");
    }
    if (!THEME_MODES.includes(request.mode)) {
      return new Error("mode must be system, light, or dark");
    }
    return undefined;
  }
}
