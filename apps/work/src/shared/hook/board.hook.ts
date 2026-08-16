import type {
  GetBoardPanelRequest,
  GetBoardPanelResponse,
  SetBoardEditModeRequest,
  SetBoardEditModeResponse,
} from "../api";

export interface IBoardApi {
  getBoardPanel(request: GetBoardPanelRequest): Promise<GetBoardPanelResponse>;
  setBoardEditMode(request: SetBoardEditModeRequest): Promise<SetBoardEditModeResponse>;
}
