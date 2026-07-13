import type { CredentialStore, Model } from "@earendil-works/pi-ai";
import type { ExecutionEnv, JsonlSessionMetadata, Skill } from "@earendil-works/pi-agent-core";

export interface AgentOptions {
  name: string;
}

export interface Agent {
  name: string;
  run(input: string): string;
}

export type AgentCoreOptions = {
  cwd: string;
  agentDir?: string;
  credentials?: CredentialStore;
};

export type AgentHarnessOptions = {
  model: Model<any>;
  metadata?: JsonlSessionMetadata;
};

export type SessionManagerOption = {
  env: ExecutionEnv;
  sessionsRoot: string;
};

export type AgentsFile = { path: string; content: string };

export type SystemPromptOptions = {
  cwd: string;
  skills: Skill[];
  agentsFiles: AgentsFile[];
  roleAdditional: string;
};
