import type { TruncationResult } from "@earendil-works/pi-agent-core";
import type { AgentMode } from "../agent-mode.js";
import type { AskUserHandler, AskUserToolDetails } from "./ask-user.js";
import type { CreateAutomationHandler, CreateAutomationToolDetails } from "./create-automation.js";
import type { DeleteAutomationHandler, DeleteAutomationToolDetails } from "./delete-automation.js";
import type { ListAutomationsHandler, ListAutomationsToolDetails } from "./list-automations.js";
import type { TodoItem, TodoListToolDetails } from "./todo-list.js";
import type { UpdateAutomationHandler, UpdateAutomationToolDetails } from "./update-automation.js";

export const TOOL_NAMES = [
  "bash",
  "read",
  "write",
  "edit",
  "ls",
  "grep",
  "find",
  "todoList",
  "webfetch",
  "websearch",
  "askUser",
  "listAutomations",
  "createAutomation",
  "updateAutomation",
  "deleteAutomation",
  "writePlan",
  "updatePlan",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type PermissionMode = "request-approval" | "delegate-approval" | "full-access";

export type PermissionModeProvider = () => PermissionMode;

export type PermissionAction = "allow" | "review" | "deny";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ApprovalReason = {
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type ApprovalAction =
  | {
      type: "exec";
      command: string;
      cwd: string;
      interactive: boolean;
      sandboxPermissions: "default" | "elevated";
      justification?: string;
      escalationToken?: string;
    }
  | {
      type: "filesystem";
      operation: "read" | "write";
      paths: string[];
      cwd: string;
    }
  | {
      type: "network";
      url: string;
      method: string;
    }
  | {
      type: "automation";
      operation: "create" | "update" | "delete" | "list";
      input: Record<string, unknown>;
    }
  | {
      type: "internal";
      capability: string;
    };

export type PermissionDecision = {
  action: PermissionAction;
  risk: RiskLevel;
  reason: ApprovalReason;
  ruleId: string;
  autoReviewable?: boolean;
  requestedPermissions?: Record<string, unknown>;
};

export type ToolPermissionContext = {
  sessionId: string;
  toolCallId: string;
  toolName: ToolName;
  input: Record<string, unknown>;
  workspaceRoot: string;
  action: ApprovalAction;
  sandboxPolicy?: SandboxPolicy;
  agentDir?: string;
};

export interface PermissionPolicy {
  supports(context: ToolPermissionContext): boolean;
  evaluate(context: ToolPermissionContext): Promise<PermissionDecision>;
}

export interface PermissionEngine {
  evaluate(context: ToolPermissionContext): Promise<PermissionDecision>;
}

export type SandboxMode = "read-only" | "workspace-write" | "full-access";

export type SandboxViolation = {
  type: "filesystem-read" | "filesystem-write" | "network" | "process" | "unknown";
  path?: string;
  host?: string;
  message: string;
};

export type BashErrorCode =
  | "PERMISSION_DENIED"
  | "USER_DENIED"
  | "SANDBOX_DENIED"
  | "SANDBOX_UNAVAILABLE"
  | "COMMAND_FAILED"
  | "TIMEOUT"
  | "ABORTED"
  | "SPAWN_FAILED";

export type PermissionEvent =
  | {
      type: "decision";
      sessionId: string;
      toolCallId: string;
      toolName: ToolName;
      permissionMode: PermissionMode;
      action: ApprovalAction;
      decision: PermissionDecision;
    }
  | {
      type: "approval";
      sessionId: string;
      toolCallId: string;
      decision: "allow" | "deny";
    }
  | {
      type: "sandbox";
      sessionId: string;
      toolCallId: string;
      mode: SandboxMode;
      denied: boolean;
      violations: SandboxViolation[];
    }
  | {
      type: "execution";
      sessionId: string;
      toolCallId: string;
      toolName: ToolName;
      outcome: "succeeded" | "failed";
      durationMs: number;
      error?: string;
    };

export type PermissionEventSink = (event: PermissionEvent) => void | Promise<void>;

export type ToolApprovalDecision = "allow" | "deny";

export type ToolApprovalReason =
  | "outside-workspace-read"
  | "outside-workspace-write"
  | "network-domain"
  | "application-launch"
  | "executable-install"
  | "process-inspection"
  | "local-network-listen"
  | "interactive-terminal"
  | "automation-create"
  | "automation-update"
  | "automation-delete"
  | "command-risk"
  | "sandbox-denied";

export type ToolApprovalRequest = {
  toolCallId: string;
  toolName: ToolName;
  input: Record<string, unknown>;
  /** 权限检查开始时捕获的等级；旧记录和兼容调用可能缺少。 */
  permissionMode?: PermissionMode;
  reason: ToolApprovalReason;
  display: string;
  mayHavePartialEffects?: boolean;
  action?: ApprovalAction;
  risk?: RiskLevel;
  ruleId?: string;
  approvalReason?: ApprovalReason;
  autoReviewable?: boolean;
  requestedPermissions?: Record<string, unknown>;
};

export type ToolApprovalHandler = (
  request: ToolApprovalRequest,
  signal?: AbortSignal,
) => Promise<ToolApprovalDecision>;

export type SandboxPolicy = {
  allowRead?: string[];
  allowWrite?: string[];
  denyWrite?: string[];
  deniedDomains?: string[];
};

export interface BaseDetails {
  msg: string;
}

export interface BashToolDetails extends BaseDetails {
  kind: "bash";
  command: string;
  exitCode: number;
  lineCount: number;
  truncation?: TruncationResult;
  fullOutputPath?: string;
  sandboxMode?: SandboxMode;
  sandboxViolations?: SandboxViolation[];
}

export interface ReadToolDetails extends BaseDetails {
  kind: "read";
  path: string;
  offset: number;
  lineCount: number;
  truncation?: TruncationResult;
}

export interface WriteToolDetails extends BaseDetails {
  kind: "write";
  path: string;
  created: boolean;
  addedLines: number;
  removedLines: number;
  lineCount: number;
  byteCount: number;
}

export interface WritePlanToolDetails extends BaseDetails {
  kind: "writePlan";
  path: string;
  fileName: string;
  lineCount: number;
  byteCount: number;
}

export interface UpdatePlanToolDetails extends BaseDetails {
  kind: "updatePlan";
  path: string;
  fileName: string;
  lineCount: number;
  byteCount: number;
}

export interface EditToolDetails extends BaseDetails {
  kind: "edit";
  path: string;
  addedLines: number;
  removedLines: number;
  diff: string;
}

export interface LsToolDetails extends BaseDetails {
  kind: "ls";
  path: string;
  entryCount: number;
}

export interface GrepToolDetails extends BaseDetails {
  kind: "grep";
  pattern: string;
  matchCount: number;
  truncation?: TruncationResult;
  matchLimitReached?: number;
  linesTruncated?: boolean;
}

export interface FindToolDetails extends BaseDetails {
  kind: "find";
  pattern: string;
  resultCount: number;
  truncation?: TruncationResult;
  resultLimitReached?: number;
}

export interface WebFetchToolDetails extends BaseDetails {
  kind: "webfetch";
  url: string;
  finalUrl: string;
  format: "text" | "markdown" | "html";
  returnedFormat: "text" | "markdown" | "html";
  timeoutMs: number;
  contentType: string;
  title: string;
  outputLength: number;
  fetchStatus: number;
  wasRetried: boolean;
  redirectCount: number;
}

export interface WebSearchResultItem {
  title: string;
  url: string;
  favicon?: string;
}

export interface WebSearchToolDetails extends BaseDetails {
  kind: "websearch";
  query: string;
  searchDepth: "basic" | "advanced";
  numResults: number;
  resultCount: number;
  hasAnswer: boolean;
  results: WebSearchResultItem[];
}

export type WillowToolDetails =
  | BashToolDetails
  | ReadToolDetails
  | WriteToolDetails
  | EditToolDetails
  | LsToolDetails
  | GrepToolDetails
  | FindToolDetails
  | TodoListToolDetails
  | WebFetchToolDetails
  | WebSearchToolDetails
  | AskUserToolDetails
  | ListAutomationsToolDetails
  | CreateAutomationToolDetails
  | UpdateAutomationToolDetails
  | DeleteAutomationToolDetails
  | WritePlanToolDetails
  | UpdatePlanToolDetails;

export type ToolRuntimeOptions = {
  cwd: string;
  sessionId?: string;
  agentDir?: string;
  agentMode?: AgentMode;
  permissionMode: PermissionMode;
  getPermissionMode?: PermissionModeProvider;
  permissionEngine?: PermissionEngine;
  permissionEventSink?: PermissionEventSink;
  escalationStore?: import("./escalation-store.js").EscalationStore;
  requestApproval?: ToolApprovalHandler;
  requestUser?: AskUserHandler;
  sandboxPolicy?: SandboxPolicy;
  tavilyApiKey?: string;
  initialTodoList?: readonly TodoItem[];
  listAutomations?: ListAutomationsHandler;
  createAutomation?: CreateAutomationHandler;
  updateAutomation?: UpdateAutomationHandler;
  deleteAutomation?: DeleteAutomationHandler;
};
