import type {
  CallToolResult,
  OAuthClientInformationMixed,
  OAuthDiscoveryState,
  OAuthTokens,
  Tool,
} from "@modelcontextprotocol/client";

export type McpServerDefinition = {
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  type?: "stdio" | "http" | "sse";
  oauth?: { clientId?: string; scope?: string; clientSecret?: string };
  disabled?: boolean;
  requestTimeoutMs?: number;
};

export type McpCredential = {
  bearerToken?: string;
  clientSecret?: string;
  secrets?: Record<string, string>;
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  expiresAt?: number;
  issuer?: string;
  redirectUri?: string;
};

export interface McpCredentialStore {
  read(key: string): Promise<McpCredential | undefined>;
  write(key: string, value: McpCredential): Promise<void>;
  delete(key: string): Promise<void>;
}

export type McpStatus =
  | "not-connected"
  | "connecting"
  | "connected"
  | "authenticating"
  | "needs-auth"
  | "failed"
  | "disabled";
export type McpServerStatus = {
  name: string;
  status: McpStatus;
  transport: "stdio" | "http";
  toolCount: number;
  cached: boolean;
  fingerprint: string;
  error?: string;
};
export type McpStatusSnapshot = {
  revision: number;
  servers: McpServerStatus[];
  connectedCount: number;
  totalTools: number;
};
export type McpToolSummary = {
  serverName: string;
  toolName: string;
  description: string;
  cached: boolean;
};
export type McpSearchInput = { query: string; serverName?: string; limit?: number };
export type McpSearchResult = { results: McpToolSummary[]; total: number; warnings: string[] };
export type McpToolDescription = McpToolSummary & {
  inputSchema: Tool["inputSchema"];
  fingerprint: string;
};
export type McpCallInput = {
  serverName: string;
  toolName: string;
  arguments: Record<string, unknown>;
};
export type McpCacheStore = {
  read(key: string): Promise<Tool[] | undefined>;
  write(key: string, tools: Tool[]): Promise<void>;
};
export type McpManagerOptions = {
  cwd: string;
  namespace: string;
  credentials: McpCredentialStore;
  cache?: McpCacheStore;
  openBrowser: (url: string) => Promise<void>;
  onAuthRequired?: (name: string, signal: AbortSignal) => Promise<void>;
  idleTimeoutMs?: number;
};

/** The runtime surface consumed by agents; supports combined global/project catalogs. */
export type McpRuntime = Pick<
  import("./manager.js").McpManager,
  "snapshot" | "search" | "describe" | "call" | "fingerprint" | "catalog"
>;
export type { CallToolResult, OAuthDiscoveryState, Tool };
