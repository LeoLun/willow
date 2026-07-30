import type { TruncationResult } from "@earendil-works/pi-agent-core";

export const TOOL_NAMES = [
  "bash",
  "read",
  "write",
  "edit",
  "ls",
  "grep",
  "find",
  "webfetch",
  "websearch",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type PermissionMode = "request-approval" | "delegate-approval" | "full-access";

export type ToolApprovalDecision = "allow" | "deny";

export type ToolApprovalReason =
  | "outside-workspace-read"
  | "outside-workspace-write"
  | "network-domain"
  | "application-launch"
  | "sandbox-denied";

export type ToolApprovalRequest = {
  toolCallId: string;
  toolName: ToolName;
  input: Record<string, unknown>;
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
  allowedDomains?: string[];
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
  sandboxed: boolean;
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
  | WebFetchToolDetails
  | WebSearchToolDetails;

export type ToolRuntimeOptions = {
  cwd: string;
  agentDir?: string;
  permissionMode: PermissionMode;
  requestApproval?: ToolApprovalHandler;
  sandboxPolicy?: SandboxPolicy;
  tavilyApiKey?: string;
};
