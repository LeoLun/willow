export interface ApiResponse<K> {
  code: number;
  msg: string;
  data?: K;
}

export interface Workspace {
  id: number;
  name: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: number;
  workspaceId: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionHistory {
  id: number;
  sessionId: number;
  message: string;
  role: "user" | "assistant";
  createdAt: Date;
}

export interface SessionDetail {
  id: number;
  workspaceId: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  history: SessionHistory[];
}

export interface GetSessionListRequest {
  workspaceId: string;
}

export interface GetSessionListResponse {
  sessions: Session[];
}
export interface GetWorkspaceListResponse {
  workspaces: Workspace[];
}

export interface CreateWorkspaceRequest {
  name: string;
  path: string;
}

export interface CreateWorkspaceResponse {
  workspace: Workspace;
}

export interface DeleteWorkspaceRequest {
  id: number;
}

export interface DeleteWorkspaceResponse {
  workspace: Workspace;
}

export interface GetWorkspaceInfoRequest {
  id: number;
}

export interface GetWorkspaceInfoResponse {
  workspace: Workspace;
}
