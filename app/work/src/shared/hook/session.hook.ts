import type {
  CreateSessionRequest,
  CreateSessionResponse,
  RenameSessionRequest,
  RenameSessionResponse,
  DeleteSessionRequest,
  DeleteSessionResponse,
  SendMessageRequest,
  SendMessageResponse,
  ResolveToolApprovalRequest,
  ResolveToolApprovalResponse,
  StopSessionStreamRequest,
  StopSessionStreamResponse,
  GetSessionListRequest,
  GetSessionListResponse,
  GetSessionRequest,
  GetSessionResponse,
  GetSessionHistoryRequest,
  GetSessionHistoryResponse,
  GetWorkspaceSessionsRequest,
  GetWorkspaceSessionsResponse,
  GetConversationSessionRequest,
  GetConversationSessionResponse,
} from "../api";

export interface ISessionApi {
  createSession(request: CreateSessionRequest): Promise<CreateSessionResponse>;
  renameSession(request: RenameSessionRequest): Promise<RenameSessionResponse>;
  deleteSession(request: DeleteSessionRequest): Promise<DeleteSessionResponse>;
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  resolveToolApproval(request: ResolveToolApprovalRequest): Promise<ResolveToolApprovalResponse>;
  stopSessionStream(request: StopSessionStreamRequest): Promise<StopSessionStreamResponse>;
  getSessionList(request: GetSessionListRequest): Promise<GetSessionListResponse>;
  getSession(request: GetSessionRequest): Promise<GetSessionResponse>;
  getSessionHistory(request: GetSessionHistoryRequest): Promise<GetSessionHistoryResponse>;
  getWorkspaceSessions(request: GetWorkspaceSessionsRequest): Promise<GetWorkspaceSessionsResponse>;
  getConversationSession(
    request?: GetConversationSessionRequest,
  ): Promise<GetConversationSessionResponse>;
}
