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
  scopeLabel: "全局" | "工作空间";
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
  | { type: "plugin"; key: string; plugin: SenderPluginOption }
  | { type: "skill"; key: string; skill: SenderSkillOption }
  | { type: "file"; key: string; file: SenderFileOption };

export interface SenderSendPayload {
  message: string;
  selectedSkills?: SenderSkillReference[];
  selectedFiles?: SenderFileReference[];
  modelId?: string;
  webSearchEnabled?: boolean;
}
