import type {
  GetFloatingBallConfigResponse,
  MoveFloatingBallWindowRequest,
  SetFloatingBallEnabledRequest,
  SetFloatingBallPositionRequest,
} from "../api";

export interface IFloatingBallApi {
  getFloatingBallConfig(): Promise<GetFloatingBallConfigResponse>;
  setFloatingBallEnabled(request: SetFloatingBallEnabledRequest): Promise<void>;
  setFloatingBallPosition(request: SetFloatingBallPositionRequest): Promise<void>;
  moveFloatingBallWindow(request: MoveFloatingBallWindowRequest): Promise<void>;
  showMainWindow(): Promise<void>;
  showFloatingBallMenu(): Promise<void>;
}
