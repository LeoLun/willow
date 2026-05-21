export type SenderSkillScope = "global" | "workspace";

export interface SenderUsageLike {
  input?: number;
  output?: number;
}

export interface SenderUsageMessage {
  usage?: SenderUsageLike;
}

export interface SenderModelOption {
  modelId: string;
  name: string;
  contextWindow?: number;
}

export interface SenderSkillOption {
  name: string;
  description: string;
  filePath: string;
  scope: SenderSkillScope;
  scopeLabel: "全局" | "工作空间" | "内置";
}

export interface SenderSkillReference {
  name: string;
  filePath: string;
  scope: SenderSkillScope;
}

export interface SenderPluginOption {
  id?: string;
  name: string;
  description: string;
}

export interface SenderBuiltinCommandOption {
  id: string;
  name: string;
  description: string;
}

export interface SenderWorkspaceAgentOption {
  workspaceId: number;
  workspaceName: string;
  workspacePath: string;
  agentName: string;
  agentDescription: string;
}

export interface SenderWorkspaceAgentReference {
  workspaceId: number;
  agentName: string;
}

export interface SenderBuiltinCommandReference {
  id: string;
  name: string;
}

export interface SenderFileOption {
  name: string;
  path: string;
  relativePath: string;
  extension?: string;
  size?: number;
}

export interface SenderFileReference {
  name: string;
  path: string;
  relativePath: string;
  extension?: string;
}

export type SenderResourcePickerItem =
  | { type: "builtin-command"; key: string; command: SenderBuiltinCommandOption }
  | { type: "workspace-agent"; key: string; workspaceAgent: SenderWorkspaceAgentOption }
  | { type: "plugin"; key: string; plugin: SenderPluginOption }
  | { type: "skill"; key: string; skill: SenderSkillOption }
  | { type: "file"; key: string; file: SenderFileOption };

export interface SenderSendPayload {
  message: string;
  selectedBuiltinCommand?: SenderBuiltinCommandReference;
  selectedSkills?: SenderSkillReference[];
  selectedFiles?: SenderFileReference[];
  selectedWorkspaceAgent?: SenderWorkspaceAgentReference;
  modelId?: string;
  webSearchEnabled?: boolean;
}
