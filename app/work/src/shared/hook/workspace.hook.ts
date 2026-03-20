import type {
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  DeleteWorkspaceRequest,
  DeleteWorkspaceResponse,
  GetWorkspaceInfoRequest,
  GetWorkspaceInfoResponse,
  GetWorkspaceListResponse,
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
}
