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
  kind: "project" | "conversation";
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

export interface SessionContextSummary {
  id: number;
  sessionId: number;
  modelId: string;
  summary: string;
  indexText: string;
  compressedUntilMessageId: number;
  sourceMessageCount: number;
  estimatedTokens: number;
  createdAt: Date;
  updatedAt: Date;
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

export interface FileReference {
  name: string;
  path: string;
  relativePath: string;
  extension?: string;
}

export interface SelectedSystemFile {
  name: string;
  path: string;
  size?: number;
  extension?: string;
}

export interface SelectFilesRequest {
  defaultPath?: string;
  multiSelections?: boolean;
}

export interface SelectFilesResponse {
  selected: boolean;
  files: SelectedSystemFile[];
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

export interface WorkspaceFileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  extension?: string;
  children?: WorkspaceFileNode[];
}

export interface GetWorkspaceFilesRequest {
  id: number;
}

export interface GetWorkspaceFilesResponse {
  rootPath: string;
  files: WorkspaceFileNode[];
}

export interface GetWorkspaceSettingsRequest {
  id: number;
}

export interface GetWorkspaceSettingsResponse {
  workspace: Workspace;
  soulContent: string;
}

export interface OpenPathRequest {
  path: string;
}

export interface OpenPathResponse {}

export interface RenameWorkspaceRequest {
  id: number;
  name: string;
}

export interface RenameWorkspaceResponse {
  workspace: Workspace;
}

export interface UpdateWorkspaceSettingsRequest {
  id: number;
  path: string;
  soulContent: string;
}

export interface UpdateWorkspaceSettingsResponse {
  workspace: Workspace;
  soulContent: string;
}

export type SkillScope = "global" | "workspace";

export interface SkillSummary {
  name: string;
  description: string;
  filePath: string;
  scope: SkillScope;
  scopeLabel: "全局" | "工作空间" | "内置";
}

export interface GetAvailableSkillsRequest {
  workspaceId?: number;
}

export interface GetAvailableSkillsResponse {
  skills: SkillSummary[];
}

export interface WorkspaceAgentSummary {
  workspaceId: number;
  workspaceName: string;
  workspacePath: string;
  agentName: string;
  agentDescription: string;
  available: boolean;
}

export interface GetWorkspaceAgentsRequest {}

export interface GetWorkspaceAgentsResponse {
  agents: WorkspaceAgentSummary[];
}

export interface SendMessageRequest {
  sessionId: number;
  message: string;
  modelId?: string;
  files?: IFile[];
  selectedBuiltinCommand?: {
    id: string;
    name: string;
  };
  selectedSkills?: {
    name: string;
    filePath: string;
  }[];
  selectedFiles?: FileReference[];
  selectedWorkspaceAgent?: {
    workspaceId: number;
    agentName: string;
  };
  webSearchEnabled?: boolean;
}

export interface SendMessageResponse {}

export interface StopSessionStreamRequest {
  sessionId: number;
}

export interface StopSessionStreamResponse {}

export interface ToolApproval {
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  title: string;
  reason: string;
  risk: "medium" | "high";
  status: "pending" | "approved" | "rejected";
}

export interface ResolveToolApprovalRequest {
  sessionId: number;
  toolCallId: string;
  decision: "approved" | "rejected";
  reason?: string;
}

export interface ResolveToolApprovalResponse {}

export type SendMessage = Omit<SendMessageRequest, "sessionId">;

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

export interface GetSessionRequest {
  sessionId: number;
}

export interface GetSessionResponse {
  session: Session;
  workspace: Workspace;
}

export interface GetSessionHistoryRequest {
  sessionId: number;
}

export interface GetConversationSessionRequest {
  sessionId?: number;
}

export interface GetConversationSessionResponse {
  session: Session;
  workspace: Workspace;
}

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
}

export interface ActiveSessionStream {
  messages: AgentMessage[];
  streamMessage: AgentMessage | null;
  isStreaming: boolean;
  pendingToolCallIds: string[];
  toolApprovals?: ToolApproval[];
  todos?: TodoItem[];
}

export interface ContextCompressionUpdate {
  sessionId: number;
  status: "compressed" | "degraded";
  message?: string;
  estimatedTokens?: number;
  chatScope?: "conversation" | "workspace";
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

export interface SetDefaultModelRequest {
  id: number;
}

export interface SetDefaultModelResponse {
  model: ModelConfig;
}

export interface SetDeepSeekApiKeyRequest {
  apiKey: string;
}

export interface SetDeepSeekApiKeyResponse {
  models: ModelConfig[];
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

export type AutomationStatus = "enabled" | "disabled";
export type AutomationTriggerType = "schedule";
export type AutomationScheduleMode = "daily_at" | "hourly" | "weekly_at" | "custom";
export type AutomationRunKind = "scheduled" | "catch_up" | "manual";
export type AutomationRunStatus = "running" | "completed" | "failed";

export interface AutomationTrigger {
  id: number;
  automationId: number;
  type: AutomationTriggerType;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationRunSummary {
  id: number;
  automationId: number;
  scheduledFor: Date;
  triggeredAt: Date;
  runKind: AutomationRunKind;
  status: AutomationRunStatus;
  sessionId?: number | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Automation {
  id: number;
  workspaceId: number;
  modelId?: string | null;
  title: string;
  prompt: string;
  status: AutomationStatus;
  triggerType: AutomationTriggerType;
  lastScheduledAt?: Date | null;
  lastRunAt?: Date | null;
  lastCompletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  trigger?: AutomationTrigger;
  latestRun?: AutomationRunSummary;
}

export interface AutomationScheduleInput {
  mode: AutomationScheduleMode;
  cronExpression: string;
  timezone?: string;
  dailyTime?: string;
  weeklyDays?: number[];
}

export interface GetAutomationListResponse {
  automations: Automation[];
}

export interface GetAutomationRequest {
  id: number;
}

export interface GetAutomationResponse {
  automation: Automation;
}

export interface CreateAutomationRequest {
  workspaceId: number;
  modelId?: string | null;
  title?: string;
  prompt: string;
  trigger: {
    type: AutomationTriggerType;
    schedule: AutomationScheduleInput;
  };
  status?: AutomationStatus;
}

export interface CreateAutomationResponse {
  automation: Automation;
}

export interface UpdateAutomationRequest {
  id: number;
  workspaceId?: number;
  modelId?: string | null;
  title?: string;
  prompt?: string;
  status?: AutomationStatus;
  trigger?: {
    type: AutomationTriggerType;
    schedule: AutomationScheduleInput;
  };
}

export interface UpdateAutomationResponse {
  automation: Automation;
}

export interface RunAutomationNowRequest {
  id: number;
}

export interface RunAutomationNowResponse {
  automation: Automation;
  session: Session;
}

export interface DeleteAutomationRequest {
  id: number;
}

export interface DeleteAutomationResponse {
  automation: Automation;
}

// ─── AI 应用视图 ───

export interface AiAppLoadRequest {
  workspaceRoot: string;
}

export interface AiAppBoundsRequest {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloatingBallConfig {
  enabled: boolean;
  x: number;
  y: number;
}

export interface GetFloatingBallConfigResponse {
  config: FloatingBallConfig;
}

export interface SetFloatingBallEnabledRequest {
  enabled: boolean;
}

export interface SetFloatingBallPositionRequest {
  x: number;
  y: number;
}

export interface MoveFloatingBallWindowRequest {
  x: number;
  y: number;
}

export interface ResizeFloatingBallWindowRequest {
  width: number;
  height: number;
  focusable?: boolean;
  isLeft?: boolean;
}

export interface ResizeFloatingBallWindowResponse {
  x: number;
  y: number;
}

// ─── 自动更新 ───

export interface CheckUpdateRequest {}

export interface CheckUpdateResponse {
  hasUpdate: boolean;
  latestVersion: string;
  updateType?: "full" | "incremental";
  releaseNotes?: string;
  publishDate?: string;
  currentVersion?: string;
}

export interface StartDownloadRequest {}
export interface StartDownloadResponse {
  success: boolean;
}

export interface InstallUpdateRequest {}
export interface InstallUpdateResponse {
  success: boolean;
}

export interface UpdateStatusPayload {
  status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
  progress?: number; // 0 - 100
  errorMsg?: string;
}

// ─── MCP Servers ───

export interface McpServerConfig {
  name: string;
  type: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  disabled?: boolean;
}

export interface GetMcpServersRequest {
  workspaceId?: number;
}

export interface GetMcpServersResponse {
  servers: McpServerConfig[];
}

export interface AddMcpServerRequest {
  workspaceId?: number;
  config: McpServerConfig;
}

export interface AddMcpServerResponse {
  servers: McpServerConfig[];
}

export interface UpdateMcpServerRequest {
  workspaceId?: number;
  config: McpServerConfig;
}

export interface UpdateMcpServerResponse {
  servers: McpServerConfig[];
}

export interface DeleteMcpServerRequest {
  workspaceId?: number;
  name: string;
}

export interface DeleteMcpServerResponse {
  servers: McpServerConfig[];
}

export interface ToggleMcpServerRequest {
  workspaceId?: number;
  name: string;
  disabled: boolean;
}

export interface ToggleMcpServerResponse {
  servers: McpServerConfig[];
}

export interface ReadFileRequest {
  workspaceId: number;
  path: string;
}

export interface ReadFileResponse {
  content: string;
}
