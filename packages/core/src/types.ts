import type { SessionMetadata, SessionRepo, Skill } from "@earendil-works/pi-agent-core";
import type { Model, MutableModels } from "@earendil-works/pi-ai";

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
};

export type AgentHarnessOptions = {
  model: Model<any>;
  metadata?: SessionMetadata;
};

export type AgentsFile = { path: string; content: string };

export type SystemPromptOptions = {
  cwd: string;
  skills: Skill[];
  agentsFiles: AgentsFile[];
  roleAdditional: string;
};
