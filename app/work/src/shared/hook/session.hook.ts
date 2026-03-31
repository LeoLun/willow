import type {
  CreateSessionRequest,
  CreateSessionResponse,
  RenameSessionRequest,
  RenameSessionResponse,
  DeleteSessionRequest,
  DeleteSessionResponse,
  SendMessageRequest,
  SendMessageResponse,
  GetSessionListRequest,
  GetSessionListResponse,
  GetSessionHistoryRequest,
  GetSessionHistoryResponse,
  GetWorkspaceSessionsRequest,
  GetWorkspaceSessionsResponse,
} from "../api";

export interface ISessionApi {
  createSession(request: CreateSessionRequest): Promise<CreateSessionResponse>;
  renameSession(request: RenameSessionRequest): Promise<RenameSessionResponse>;
  deleteSession(request: DeleteSessionRequest): Promise<DeleteSessionResponse>;
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  getSessionList(request: GetSessionListRequest): Promise<GetSessionListResponse>;
  getSessionHistory(request: GetSessionHistoryRequest): Promise<GetSessionHistoryResponse>;
  getWorkspaceSessions(request: GetWorkspaceSessionsRequest): Promise<GetWorkspaceSessionsResponse>;
}
