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
  agentDir?: string;
  agentMode?: AgentMode;
  permissionMode: PermissionMode;
  getPermissionMode?: PermissionModeProvider;
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
