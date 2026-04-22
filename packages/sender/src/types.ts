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

export interface SenderSendPayload {
  message: string;
  selectedSkills?: SenderSkillReference[];
  selectedFiles?: SenderFileReference[];
  modelId?: string;
  webSearchEnabled?: boolean;
}
