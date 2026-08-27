import type { SessionMetadata, SessionRepo, Skill } from "@earendil-works/pi-agent-core";
import type { Model, MutableModels } from "@earendil-works/pi-ai";
import type { AgentMode } from "./agent-mode.js";
import type { AskUserHandler } from "./tools/ask-user.js";
import type { CreateAutomationHandler } from "./tools/create-automation.js";
import type { DeleteAutomationHandler } from "./tools/delete-automation.js";
import type { ListAutomationsHandler } from "./tools/list-automations.js";
import type {
  PermissionMode,
  PermissionModeProvider,
  SandboxPolicy,
  ToolApprovalHandler,
} from "./tools/types.js";
import type { UpdateAutomationHandler } from "./tools/update-automation.js";

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
  builtinSkills?: {
    directory: string;
    disabledIds?: readonly string[];
  };
  tavilyApiKey?: string;
  createAutomation?: CreateAutomationHandler;
};

export type AgentHarnessOptions = {
  model: Model<any>;
  metadata?: SessionMetadata;
  agentMode?: AgentMode;
  permissionMode?: PermissionMode;
  getPermissionMode?: PermissionModeProvider;
  requestApproval?: ToolApprovalHandler;
  requestUser?: AskUserHandler;
  sandboxPolicy?: SandboxPolicy;
  listAutomations?: ListAutomationsHandler;
  createAutomation?: CreateAutomationHandler;
  updateAutomation?: UpdateAutomationHandler;
  deleteAutomation?: DeleteAutomationHandler;
};

export type AgentsFile = { path: string; content: string };

export type SystemPromptOptions = {
  cwd: string;
  agentDir: string;
  skills: Skill[];
  agentsFiles: AgentsFile[];
  roleAdditional: string;
};
