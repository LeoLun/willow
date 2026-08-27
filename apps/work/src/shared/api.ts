import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, ModelThinkingLevel } from "@earendil-works/pi-ai";
import type {
  AgentMode,
  AskUserAnswers,
  AskUserRequest,
  PermissionMode,
  ToolApprovalDecision,
  ToolApprovalRequest,
} from "@willow/core";
import type { LocalFileAttachment } from "./local-file";

export type { LocalFileAttachment } from "./local-file";

export type { AgentMode, AskUserAnswers, PermissionMode, ToolApprovalDecision };

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

export type AppUpdateState =
  | { status: "checking" | "upToDate" | "checkFailed"; currentVersion: string }
  | {
      status: "hotAvailable" | "downloading" | "ready" | "downloadFailed";
      currentVersion: string;
      latestVersion: string;
      progress: number;
    }
  | {
      status: "manualAvailable";
      currentVersion: string;
      latestVersion: string;
      releaseUrl: string;
    };

export interface AppUpdateRequest {}
export type AppUpdateResponse = AppUpdateState;
export interface RestartToUpdateResponse {}
export interface OpenManualUpdateResponse {}

export type ThemeMode = "system" | "light" | "dark";

export interface SetThemeRequest {
  mode: ThemeMode;
}

export interface SetThemeResponse {}

export interface AutoLaunchState {
  enabled: boolean;
  supported: boolean;
  requiresApproval: boolean;
}

export interface GetAutoLaunchRequest {}

export type GetAutoLaunchResponse = AutoLaunchState;

export interface SetAutoLaunchRequest {
  enabled: boolean;
}

export type SetAutoLaunchResponse = AutoLaunchState;

export type ThinkingLevel = Exclude<ModelThinkingLevel, "off">;

export interface ProviderModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
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

export interface GetBoardPanelRequest {
  workspaceId: number;
}

export type GetBoardPanelResponse = { status: "missing" } | { status: "ready"; url: string };

export interface SetBoardEditModeRequest {
  workspaceId: number;
  tabId: string;
  enabled: boolean;
}

export interface SetBoardEditModeResponse {
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

export interface ListWorkspaceDirectoryRequest {
  workspaceId: number;
  directoryPath: string;
  cursor?: string;
  limit?: number;
}

export interface ListWorkspaceDirectoryResponse {
  entries: FileSearchItem[];
  nextCursor?: string;
}

export type WorkspaceFilePreviewStatus = "ready" | "too-large" | "binary";

export interface WorkspaceFileContent {
  content?: string;
  modifiedAt: number;
  name: string;
  relativePath: string;
  size: number;
  status: WorkspaceFilePreviewStatus;
}

export interface ReadWorkspaceFileRequest {
  workspaceId: number;
  relativePath: string;
}

export interface ReadWorkspaceFileResponse {
  file: WorkspaceFileContent;
}

export type PlanFileReadStatus = "ready" | "too-large" | "binary";

export interface PlanFileContent {
  content: string;
  name: string;
  path: string;
  byteCount: number;
  lineCount: number;
  status: PlanFileReadStatus;
}

export interface ReadPlanFileRequest {
  path: string;
}

export interface ReadPlanFileResponse {
  file: PlanFileContent;
}

export interface OpenWorkspaceFileRequest {
  workspaceId: number;
  relativePath: string;
}

export interface OpenWorkspaceFileResponse {}

export interface RevealWorkspaceEntryRequest {
  workspaceId: number;
  relativePath: string;
}

export interface RevealWorkspaceEntryResponse {}

export interface SubscribeWorkspaceFilesRequest {
  workspaceId: number;
  subscriptionId: string;
}

export interface SubscribeWorkspaceFilesResponse {}

export interface UnsubscribeWorkspaceFilesRequest {
  subscriptionId: string;
}

export interface UnsubscribeWorkspaceFilesResponse {}

export type WorkspaceFileChangeType = "add" | "change" | "unlink" | "addDir" | "unlinkDir";

export interface WorkspaceFileChange {
  relativePath: string;
  type: WorkspaceFileChangeType;
}

export interface WorkspaceFilesChangedEvent {
  changes: WorkspaceFileChange[];
  workspaceId: number;
}

export type GitReviewArea = "staged" | "unstaged";
export type GitReviewChangeStatus =
  | "added"
  | "conflicted"
  | "copied"
  | "deleted"
  | "modified"
  | "renamed"
  | "typeChanged"
  | "untracked";

export interface GitReviewChange {
  additions?: number;
  area: GitReviewArea;
  deletions?: number;
  oldPath?: string;
  path: string;
  status: GitReviewChangeStatus;
}

export type GitReviewStatus =
  | { repository: false }
  | {
      repository: true;
      branch: string;
      upstream?: string;
      ahead: number;
      behind: number;
      additions: number;
      deletions: number;
      staged: GitReviewChange[];
      unstaged: GitReviewChange[];
    };

export interface GetGitReviewStatusRequest {
  workspaceId: number;
}

export interface GetGitReviewStatusResponse {
  review: GitReviewStatus;
}

export interface GetGitReviewDiffRequest {
  workspaceId: number;
  area: GitReviewArea;
  path: string;
  oldPath?: string;
}

export interface GitReviewDiff {
  binary: boolean;
  content: string;
  truncated: boolean;
}

export interface GetGitReviewDiffResponse {
  diff: GitReviewDiff;
}

export interface UpdateGitReviewIndexRequest {
  workspaceId: number;
  paths?: string[];
}

export interface UpdateGitReviewIndexResponse {}

export interface CommitGitChangesRequest {
  workspaceId: number;
  message: string;
}

export interface CommitGitChangesResponse {
  commitHash: string;
}

export interface SelectLocalFilesRequest {
  kind?: "file" | "directory";
}

export interface SelectLocalFilesResponse {
  files: LocalFileAttachment[];
}

export interface InspectLocalFilesRequest {
  paths: string[];
}

export interface InspectLocalFilesResponse {
  files: LocalFileAttachment[];
}

export interface ClipboardImagePayload {
  name: string;
  mimeType: string;
  data: ArrayBuffer;
}

export interface PersistClipboardImagesRequest {
  images: ClipboardImagePayload[];
}

export interface PersistClipboardImagesResponse {
  files: LocalFileAttachment[];
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

export interface OpenWorkspaceDirectoryRequest {
  workspaceId: number;
}

export interface OpenWorkspaceDirectoryResponse {}

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

export type MessageStreamPatch =
  | {
      type: "text_start" | "text_end" | "thinking_start" | "thinking_end" | "toolcall_start";
      contentIndex: number;
      content: AssistantMessage["content"][number];
    }
  | {
      type: "text_delta" | "thinking_delta";
      contentIndex: number;
      delta: string;
    }
  | {
      type: "toolcall_delta" | "toolcall_end";
      contentIndex: number;
      content: AssistantMessage["content"][number];
    };

export type MessageStreamEvent =
  | {
      type: "start" | "end";
      message: AgentMessage;
    }
  | {
      type: "update";
      messageTimestamp: number;
      patches: MessageStreamPatch[];
    };

export type MessageEventPayload =
  | {
      type: "stream";
      sessionId: string;
      event: MessageStreamEvent;
    }
  | {
      type: "artifact";
      sessionId: string;
      artifact: TurnArtifactBundle;
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
  agentMode?: AgentMode;
  attachments?: LocalFileAttachment[];
}

export interface SendMessageResponse {
  message: AssistantMessage;
}

export interface SetPermissionModeRequest {
  workspaceId: number;
  sessionId: string;
  permissionMode: PermissionMode;
}

export interface SetPermissionModeResponse {
  permissionMode: PermissionMode;
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

export type TurnFileArtifactStatus = "added" | "modified" | "deleted" | "renamed";

export interface TurnFileArtifact {
  additions?: number;
  deletions?: number;
  oldPath?: string;
  path: string;
  status: TurnFileArtifactStatus;
}

export interface TurnPlanArtifact {
  byteCount: number;
  content: string;
  fileName: string;
  lineCount: number;
  path: string;
}

export interface TurnArtifactBundle {
  assistantTimestamp: number;
  files: TurnFileArtifact[];
  plans: TurnPlanArtifact[];
  version: 1;
}

export interface GetMessageListResponse {
  messages: AgentMessage[];
  artifacts: TurnArtifactBundle[];
  pendingToolApproval?: ToolApprovalEventPayload;
  pendingUserQuestion?: UserQuestionEventPayload;
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

export type UserQuestionEventPayload = AskUserRequest & {
  requestId: string;
  workspaceId: number;
  sessionId: string;
};

export type UserQuestionResolvedEventPayload = Pick<
  UserQuestionEventPayload,
  "requestId" | "workspaceId" | "sessionId"
>;

export interface ResolveUserQuestionRequest {
  requestId: string;
  workspaceId: number;
  sessionId: string;
  answers?: AskUserAnswers;
}

export interface ResolveUserQuestionResponse {
  resolved: boolean;
}

export type AutomationStatus = "enabled" | "disabled";
export type AutomationTriggerType = "schedule";
export type AutomationScheduleMode = "daily_at" | "hourly" | "weekly_at" | "custom";
export type AutomationRunKind = "scheduled" | "catch_up" | "manual";
export type AutomationRunStatus = "running" | "completed" | "failed" | "skipped" | "interrupted";

export interface AutomationTriggerInfo {
  id: number;
  automationId: number;
  type: AutomationTriggerType;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationInfo {
  id: number;
  workspaceId: number;
  title: string;
  prompt: string;
  status: AutomationStatus;
  model?: ModelConfig;
  lastScheduledAt?: Date;
  lastRunAt?: Date;
  lastCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  trigger: AutomationTriggerInfo;
}

export interface AutomationRunInfo {
  id: number;
  automationId: number;
  workspaceId: number;
  sessionId?: string;
  runKind: AutomationRunKind;
  status: AutomationRunStatus;
  scheduledFor?: Date;
  triggeredAt: Date;
  finishedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationListItem {
  id: number;
  workspaceId: number;
  workspaceName: string;
  title: string;
  status: AutomationStatus;
  cronExpression: string;
  timezone: string;
  nextRunAt?: Date;
  lastRun?: Pick<AutomationRunInfo, "status" | "runKind" | "triggeredAt" | "finishedAt">;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationTriggerInput {
  type: AutomationTriggerType;
  cronExpression: string;
  timezone: string;
  isActive?: boolean;
}

export interface CreateAutomationRequest {
  workspaceId: number;
  title?: string;
  prompt: string;
  status?: AutomationStatus;
  model?: ModelConfig;
  trigger: AutomationTriggerInput;
}

export interface UpdateAutomationRequest {
  id: number;
  workspaceId?: number;
  title?: string;
  prompt?: string;
  status?: AutomationStatus;
  model?: ModelConfig | null;
  trigger?: Partial<AutomationTriggerInput>;
}

export interface DeleteAutomationRequest {
  id: number;
}

export interface GetAutomationRequest {
  id: number;
}

export interface ListAutomationsRequest {}

export interface ListAutomationsResponse {
  automations: AutomationListItem[];
}

export interface GetAutomationResponse {
  automation: AutomationInfo;
}

export interface CreateAutomationResponse {
  automation: AutomationInfo;
}

export interface UpdateAutomationResponse {
  automation: AutomationInfo;
}

export interface DeleteAutomationResponse {}

export interface RunAutomationNowRequest {
  id: number;
}

export type RunAutomationNowResponse = AutomationRunInfo;

export interface ListAutomationRunsRequest {
  automationId: number;
  cursor?: number;
  limit?: number;
}

export interface ListAutomationRunsResponse {
  runs: AutomationRunInfo[];
  nextCursor?: number;
}

export type AutomationChangedEvent = {
  automationId: number;
  type: "created" | "updated" | "deleted" | "run-started" | "run-finished";
};
