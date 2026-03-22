import type {
  CreateSessionRequest,
  CreateSessionResponse,
  SendMessageRequest,
  SendMessageResponse,
  GetSessionListRequest,
  GetSessionListResponse,
} from "../api";

export interface ISessionApi {
  createSession(request: CreateSessionRequest): Promise<CreateSessionResponse>;
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  getSessionList(
    request: GetSessionListRequest,
  ): Promise<GetSessionListResponse>;
}
