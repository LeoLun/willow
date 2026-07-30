import type { AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { PermissionMode, ToolApprovalDecision, ToolApprovalRequest } from "@willow/core";

export type { PermissionMode, ToolApprovalDecision };

export interface ApiResponse<K> {
  code: number;
  msg: string;
  data?: K;
}
export interface RegisterEventRequest {
  event?: string;
}

export interface RegisterEventResponse {}

export interface GetAppInfoRequest {}

export interface GetAppInfoResponse {
  name: string;
  version: string;
}

export type ThemeMode = "system" | "light" | "dark";

export interface SetThemeRequest {
  mode: ThemeMode;
}

export interface SetThemeResponse {}

export type ThinkingLevel = Exclude<ModelThinkingLevel, "off">;

export interface ProviderModelInfo {
  id: string;
  name: string;
  thinkingLevels: ThinkingLevel[];
}

export interface ProviderInfo {
  id: string;
  name: string;
  apiKeyLabel: string;
  models: ProviderModelInfo[];
}

export interface GetProviderCatalogRequest {}

export interface GetProviderCatalogResponse {
  providers: ProviderInfo[];
}

export interface SkillInfo {
  name: string;
  description: string;
  filePath: string;
  source: "builtin" | "global" | "project";
}

export interface BuiltinSkillInfo {
  id: string;
  name: string;
  description: string;
  scope: "global";
  enabled: boolean;
}

export interface GetBuiltinSkillListRequest {}

export interface GetBuiltinSkillListResponse {
  skills: BuiltinSkillInfo[];
}

export interface SetBuiltinSkillEnabledRequest {
  id: string;
  enabled: boolean;
}

export interface SetBuiltinSkillEnabledResponse {
  skill: BuiltinSkillInfo;
}

export interface GetSkillListRequest {
  workspaceId: number;
}

export interface GetSkillListResponse {
  skills: SkillInfo[];
}

export interface FileSearchItem {
  name: string;
  relativePath: string;
  type: "file" | "directory";
}

export interface SearchFilesRequest {
  workspaceId: number;
  query: string;
}

export interface SearchFilesResponse {
  files: FileSearchItem[];
}

export interface GetCredentialRequest {
  providerId: string;
}

export interface GetCredentialResponse {
  configured: boolean;
}

export interface GetConfiguredProvidersRequest {}

export interface GetConfiguredProvidersResponse {
  providerIds: string[];
}

export type StatisticsGranularity = "daily" | "weekly" | "all";

export interface GetStatisticsRequest {
  granularity: StatisticsGranularity;
}

export interface StatisticsSummary {
  totalTokens: number;
  cacheReadTokens: number;
  totalTasks: number;
  totalCost: number;
}

export interface StatisticsActivityModelUsage {
  providerId: string;
  modelId: string;
  modelName: string;
  tokens: number;
}

export interface StatisticsActivityBucket {
  key: string;
  label: string;
  startAt: string;
  endAt: string;
  totalTokens: number;
  models: StatisticsActivityModelUsage[];
}

export interface StatisticsModelUsage {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  totalTokens: number;
  cacheReadTokens: number;
  cacheRatio: number;
  totalCost: number;
  share: number;
}

export interface GetStatisticsResponse {
  granularity: StatisticsGranularity;
  summary: StatisticsSummary;
  activityBuckets: StatisticsActivityBucket[];
  modelUsage: StatisticsModelUsage[];
}

export interface SetCredentialRequest {
  providerId: string;
  apiKey: string;
}

export interface SetCredentialResponse {}

export interface DeleteCredentialRequest {
  providerId: string;
}

export interface DeleteCredentialResponse {}

export interface TavilyUsageInfo {
  currentPlan: string;
  planUsage: number;
  planLimit: number;
}

export interface GetTavilySettingsRequest {}

export interface GetTavilySettingsResponse {
  configured: boolean;
  usage?: TavilyUsageInfo;
  usageError?: string;
}

export interface SetTavilyApiKeyRequest {
  apiKey: string;
}

export interface SetTavilyApiKeyResponse {
  configured: true;
  usage: TavilyUsageInfo;
}

export interface DeleteTavilyApiKeyRequest {}

export interface DeleteTavilyApiKeyResponse {}

export interface WorkspaceInfo {
  id: number;
  name: string;
  path: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetWorkspaceListRequest {
  pinned: boolean;
}

export interface GetWorkspaceListResponse {
  workspaces: WorkspaceInfo[];
}

export interface CreateWorkspaceRequest {
  name: string;
  path: string;
}

export interface CreateWorkspaceResponse {
  workspace: WorkspaceInfo;
}

export interface SelectWorkspaceDirectoryRequest {}

export interface SelectWorkspaceDirectoryResponse {
  directory: Pick<WorkspaceInfo, "name" | "path"> | null;
}

export interface SetWorkspacePinnedRequest {
  workspaceId: number;
  pinned: boolean;
}

export interface SetWorkspacePinnedResponse {
  workspace: WorkspaceInfo;
}

export interface RenameWorkspaceRequest {
  workspaceId: number;
  name: string;
}

export interface RenameWorkspaceResponse {
  workspace: WorkspaceInfo;
}

export interface GetWorkspaceDetailRequest {
  workspaceId: number;
}

export interface GetWorkspaceDetailResponse {
  workspace: WorkspaceInfo;
}

export interface DeleteWorkspaceRequest {
  workspaceId: number;
}

export interface DeleteWorkspaceResponse {}

export interface ModelConfig {
  providerId: string;
  modelId: string;
}

export interface UserConfigInfo {
  largeModel?: ModelConfig;
  smallModel?: ModelConfig;
}

export interface GetUserConfigRequest {}

export type GetUserConfigResponse = UserConfigInfo;

export type SetUserConfigRequest = UserConfigInfo;

export type SetUserConfigResponse = UserConfigInfo;

export interface CreateSessionRequest {
  workspaceId: number;
}

export interface CreateSessionResponse {
  sessionId: string;
}

export type SessionStatus = "started" | "completed" | "stopped" | "failed";

export interface SessionInfo {
  id: string;
  workspaceId: number;
  title: string;
  createdAt: string;
  status: SessionStatus;
}

export interface GetSessionListRequest {
  workspaceId: number;
}

export interface GetSessionListResponse {
  sessions: SessionInfo[];
}

export type MessageStreamEvent = Extract<
  AgentEvent,
  { type: "message_start" | "message_update" | "message_end" }
>;

export type MessageEventPayload =
  | {
      type: "stream";
      sessionId: string;
      event: MessageStreamEvent;
    }
  | {
      type: "status";
      sessionId: string;
      status: SessionStatus;
      error?: string;
    }
  | {
      type: "title_updated";
      sessionId: string;
      title: string;
    };

export interface SendMessageRequest {
  workspaceId: number;
  sessionId: string;
  content: string;
  model: ModelConfig;
  approvalMode?: PermissionMode;
}

export interface SendMessageResponse {
  message: AssistantMessage;
}

export interface StopMessageRequest {
  workspaceId: number;
  sessionId: string;
}

export interface StopMessageResponse {
  stopped: boolean;
}

export interface GetMessageListRequest {
  workspaceId: number;
  sessionId: string;
}

export interface GetMessageListResponse {
  messages: AgentMessage[];
  pendingToolApproval?: ToolApprovalEventPayload;
}

export type AiApprovalReview = {
  status: "rejected" | "failed";
  reason: string;
};

export type ToolApprovalEventPayload = ToolApprovalRequest & {
  approvalId: string;
  workspaceId: number;
  sessionId: string;
  aiReview?: AiApprovalReview;
};

export type ToolApprovalResolvedEventPayload = Pick<
  ToolApprovalEventPayload,
  "approvalId" | "workspaceId" | "sessionId"
>;

export interface ResolveToolApprovalRequest {
  approvalId: string;
  workspaceId: number;
  sessionId: string;
  decision: ToolApprovalDecision;
}

export interface ResolveToolApprovalResponse {
  resolved: boolean;
}
