import type { RegisterEventRequest, RegisterEventResponse } from "../api";

export interface IEventApi {
  registerEvent(
    request: RegisterEventRequest,
    callback?: (event: string, data: any) => void,
  ): Promise<RegisterEventResponse>;
  onEventBus(callback: (event: string, data: any) => void): void;
}
