import type {
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionListRequest,
  GetSessionListResponse,
} from "../api";

export interface ISessionApi {
  createSession(request: CreateSessionRequest): Promise<CreateSessionResponse>;
  getSessionList(request: GetSessionListRequest): Promise<GetSessionListResponse>;
}
