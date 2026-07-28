import type { SessionMetadata, SessionRepo, Skill } from "@earendil-works/pi-agent-core";
import type { Model, MutableModels } from "@earendil-works/pi-ai";
import type { PermissionMode, SandboxPolicy, ToolApprovalHandler } from "./tools/types.js";

export interface AgentOptions {
  name: string;
}

export interface Agent {
  name: string;
  run(input: string): string;
}

export type AgentCoreOptions = {
  cwd: string;
  models: MutableModels;
  sessionRepo: SessionRepo;
  agentDir?: string;
  tavilyApiKey?: string;
};

export type AgentHarnessOptions = {
  model: Model<any>;
  metadata?: SessionMetadata;
  permissionMode?: PermissionMode;
  requestApproval?: ToolApprovalHandler;
  sandboxPolicy?: SandboxPolicy;
};

export type AgentsFile = { path: string; content: string };

export type SystemPromptOptions = {
  cwd: string;
  skills: Skill[];
  agentsFiles: AgentsFile[];
  roleAdditional: string;
};
