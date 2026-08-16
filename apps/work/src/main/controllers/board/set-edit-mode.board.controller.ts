import {
  BoardPanelFrameNotFoundError,
  BoardPanelService,
  InvalidBoardPanelPathError,
} from "@main/service/board-panel.service";
import { WorkspaceNotFoundError } from "@main/service/workspace.service";
import type { ApiResponse, SetBoardEditModeRequest, SetBoardEditModeResponse } from "@shared/api";
import { SET_BOARD_EDIT_MODE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "../workspace/workspace-controller.params";

@Injectable()
export class SetBoardEditModeController extends IPCBaseController<
  SetBoardEditModeRequest,
  SetBoardEditModeResponse
> {
  constructor(private readonly boardPanelService: BoardPanelService) {
    super();
  }

  @IPC(SET_BOARD_EDIT_MODE)
  async run(
    event: Electron.IpcMainInvokeEvent,
    request: SetBoardEditModeRequest,
  ): Promise<ApiResponse<SetBoardEditModeResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      await this.boardPanelService.setEditMode(
        event.sender,
        request.workspaceId,
        request.tabId,
        request.enabled,
      );
      return this.buildResponse({ enabled: request.enabled });
    } catch (error) {
      if (
        error instanceof WorkspaceNotFoundError ||
        error instanceof BoardPanelFrameNotFoundError
      ) {
        return this.buildError(404, error.message);
      }
      if (error instanceof InvalidBoardPanelPathError) {
        return this.buildError(400, error.message);
      }
      throw error;
    }
  }

  checkParams(request: SetBoardEditModeRequest): Error | undefined {
    const workspaceError = checkWorkspaceId(request);
    if (workspaceError) return workspaceError;
    if (
      typeof request.tabId !== "string" ||
      request.tabId.length === 0 ||
      request.tabId.length > 200
    ) {
      return new Error("tabId must be a non-empty string up to 200 characters");
    }
    if (typeof request.enabled !== "boolean") return new Error("enabled must be a boolean");
    return undefined;
  }
}
