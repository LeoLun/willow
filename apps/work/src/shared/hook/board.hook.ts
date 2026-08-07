import type { GetBoardPanelRequest, GetBoardPanelResponse } from "../api";

export interface IBoardApi {
  getBoardPanel(request: GetBoardPanelRequest): Promise<GetBoardPanelResponse>;
}
