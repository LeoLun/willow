import { BoardPanelService, InvalidBoardPanelPathError } from "@main/service/board-panel.service";
import { WorkspaceNotFoundError } from "@main/service/workspace.service";
import type { ApiResponse, GetBoardPanelRequest, GetBoardPanelResponse } from "@shared/api";
import { GET_BOARD_PANEL } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "../workspace/workspace-controller.params";

@Injectable()
export class GetBoardPanelController extends IPCBaseController<
  GetBoardPanelRequest,
  GetBoardPanelResponse
> {
  constructor(private readonly boardPanelService: BoardPanelService) {
    super();
  }

  @IPC(GET_BOARD_PANEL)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetBoardPanelRequest,
  ): Promise<ApiResponse<GetBoardPanelResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      return this.buildResponse(await this.boardPanelService.getBoardPanel(request.workspaceId));
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        return this.buildError(404, "Workspace not found");
      }
      if (error instanceof InvalidBoardPanelPathError) {
        return this.buildError(400, error.message);
      }
      throw error;
    }
  }

  checkParams(request: GetBoardPanelRequest): Error | undefined {
    return checkWorkspaceId(request);
  }
}
