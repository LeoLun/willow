import type {
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  DeleteWorkspaceRequest,
  DeleteWorkspaceResponse,
  GetWorkspaceListRequest,
  GetWorkspaceListResponse,
  OpenWorkspaceDirectoryRequest,
  OpenWorkspaceDirectoryResponse,
  RenameWorkspaceRequest,
  RenameWorkspaceResponse,
  SelectWorkspaceDirectoryRequest,
  SelectWorkspaceDirectoryResponse,
  SetWorkspacePinnedRequest,
  SetWorkspacePinnedResponse,
} from "../api";

export interface IWorkspaceApi {
  getWorkspaceList(request: GetWorkspaceListRequest): Promise<GetWorkspaceListResponse>;
  createWorkspace(request: CreateWorkspaceRequest): Promise<CreateWorkspaceResponse>;
  selectWorkspaceDirectory(
    request?: SelectWorkspaceDirectoryRequest,
  ): Promise<SelectWorkspaceDirectoryResponse>;
  openWorkspaceDirectory(
    request: OpenWorkspaceDirectoryRequest,
  ): Promise<OpenWorkspaceDirectoryResponse>;
  setWorkspacePinned(request: SetWorkspacePinnedRequest): Promise<SetWorkspacePinnedResponse>;
  renameWorkspace(request: RenameWorkspaceRequest): Promise<RenameWorkspaceResponse>;
  deleteWorkspace(request: DeleteWorkspaceRequest): Promise<DeleteWorkspaceResponse>;
}
