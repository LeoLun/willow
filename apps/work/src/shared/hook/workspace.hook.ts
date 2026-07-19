import type {
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  DeleteWorkspaceRequest,
  DeleteWorkspaceResponse,
  GetWorkspaceListRequest,
  GetWorkspaceListResponse,
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
  setWorkspacePinned(request: SetWorkspacePinnedRequest): Promise<SetWorkspacePinnedResponse>;
  renameWorkspace(request: RenameWorkspaceRequest): Promise<RenameWorkspaceResponse>;
  deleteWorkspace(request: DeleteWorkspaceRequest): Promise<DeleteWorkspaceResponse>;
}
