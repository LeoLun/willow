import type {
  GetWorkspaceListResponse,
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  DeleteWorkspaceRequest,
  DeleteWorkspaceResponse,
  GetWorkspaceInfoRequest,
  GetWorkspaceInfoResponse,
  RenameWorkspaceRequest,
  RenameWorkspaceResponse,
} from "../api";

export interface IWorkspaceApi {
  getWorkspaceList(): Promise<GetWorkspaceListResponse>;
  createWorkspace(
    request: CreateWorkspaceRequest,
  ): Promise<CreateWorkspaceResponse>;
  deleteWorkspace(
    request: DeleteWorkspaceRequest,
  ): Promise<DeleteWorkspaceResponse>;
  getWorkspaceInfo(
    request: GetWorkspaceInfoRequest,
  ): Promise<GetWorkspaceInfoResponse>;
  renameWorkspace(
    request: RenameWorkspaceRequest,
  ): Promise<RenameWorkspaceResponse>;
}
