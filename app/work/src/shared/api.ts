import type { AgentMessage } from "@mariozechner/pi-agent-core";

export interface ApiResponse<K> {
  code: number;
  msg: string;
  data?: K;
}

export interface Workspace {
  id: number;
  name: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: number;
  workspaceId: number;
  title: string;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionHistory {
  id: number;
  sessionId: number;
  message: string;
  role: "user" | "assistant";
  createdAt: Date;
}

export interface SessionDetail {
  id: number;
  workspaceId: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  history: SessionHistory[];
}

export interface IFile {
  name: string;
  size: number;
  path: string;
}
export interface GetWorkspaceListResponse {
  workspaces: Workspace[];
}

export interface CreateWorkspaceRequest {
  name: string;
  path?: string;
}

export interface CreateWorkspaceResponse {
  workspace: Workspace;
}

export interface DeleteWorkspaceRequest {
  id: number;
}

export interface DeleteWorkspaceResponse {
  workspace: Workspace;
}

export interface GetWorkspaceInfoRequest {
  id: number;
}

export interface GetWorkspaceInfoResponse {
  workspace: Workspace;
}

export interface RenameWorkspaceRequest {
  id: number;
  name: string;
}

export interface RenameWorkspaceResponse {
  workspace: Workspace;
}

export interface SendMessageRequest {
  sessionId: number;
  message: string;
  modelId?: string;
  files?: IFile[];
  webSearchEnabled?: boolean;
}

export interface SendMessageResponse {}

export interface StopSessionStreamRequest {
  sessionId: number;
}

export interface StopSessionStreamResponse {}

export interface SendMessage extends Omit<SendMessageRequest, "sessionId"> {}

export interface CreateSessionRequest {
  workspaceId: number;
}

export interface CreateSessionResponse {
  session: Session;
}

export interface RenameSessionRequest {
  id: number;
  title: string;
}

export interface RenameSessionResponse {
  session: Session;
}

export interface DeleteSessionRequest {
  id: number;
}

export interface DeleteSessionResponse {
  session: Session;
}

export interface GetSessionListResponse {
  sessions: {
    [workspaceId: number]: Session[];
  };
  totals?: {
    [workspaceId: number]: number;
  };
}

export interface GetSessionListRequest {
  workspaceIds: number[];
  limit?: number;
}

export interface GetWorkspaceSessionsRequest {
  workspaceId: number;
  page: number;
  pageSize: number;
}

export interface GetWorkspaceSessionsResponse {
  sessions: Session[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GetSessionHistoryRequest {
  sessionId: number;
}

export interface ActiveSessionStream {
  messages: AgentMessage[];
  streamMessage: AgentMessage | null;
  isStreaming: boolean;
  pendingToolCallIds: string[];
}

export interface GetSessionHistoryResponse {
  messages: AgentMessage[];
  activeStream?: ActiveSessionStream;
}

export interface RegisterEventRequest {
  event?: string;
}

export interface RegisterEventResponse {}

// ─── 模型配置 ───

export interface ModelConfig {
  id: number;
  modelId: string;
  name: string;
  api: string;
  provider: string;
  baseUrl: string;
  apiKey?: string | null;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetModelListResponse {
  models: ModelConfig[];
}

export interface AddModelRequest {
  modelId: string;
  name: string;
  api: string;
  provider: string;
  baseUrl: string;
  apiKey?: string;
  reasoning?: boolean;
  contextWindow?: number;
  maxTokens?: number;
  isDefault?: boolean;
}

export interface AddModelResponse {
  model: ModelConfig;
}

export interface UpdateModelRequest {
  id: number;
  modelId?: string;
  name?: string;
  api?: string;
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  reasoning?: boolean;
  contextWindow?: number;
  maxTokens?: number;
  isDefault?: boolean;
}

export interface UpdateModelResponse {
  model: ModelConfig;
}

export interface DeleteModelRequest {
  id: number;
}

export interface DeleteModelResponse {
  model: ModelConfig;
}

export interface SetDefaultModelRequest {
  id: number;
}

export interface SetDefaultModelResponse {
  model: ModelConfig;
}

// ─── Tavily API Key 配置 ───

export interface TavilyKeyConfig {
  id: number;
  apiKey: string;
  monthlyLimit: number;
  currentMonthUsage: number;
  usageResetMonth: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetTavilyKeyListResponse {
  keys: TavilyKeyConfig[];
}

export interface AddTavilyKeyRequest {
  apiKey: string;
  monthlyLimit?: number;
}

export interface AddTavilyKeyResponse {
  key: TavilyKeyConfig;
}

export interface UpdateTavilyKeyRequest {
  id: number;
  apiKey?: string;
  monthlyLimit?: number;
}

export interface UpdateTavilyKeyResponse {
  key: TavilyKeyConfig;
}

export interface DeleteTavilyKeyRequest {
  id: number;
}

export interface DeleteTavilyKeyResponse {
  key: TavilyKeyConfig;
}
