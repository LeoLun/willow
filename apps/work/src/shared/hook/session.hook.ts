import type { CreateSessionRequest, CreateSessionResponse } from "../api";

export interface ISessionApi {
  createSession(request: CreateSessionRequest): Promise<CreateSessionResponse>;
}
