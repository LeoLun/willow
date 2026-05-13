import type { AiAppBoundsRequest, AiAppLoadRequest } from "../api";

export interface IAiAppApi {
  loadAiApp(request: AiAppLoadRequest): Promise<void>;
  updateAiAppBounds(request: AiAppBoundsRequest): Promise<void>;
  closeAiApp(): Promise<void>;
}
