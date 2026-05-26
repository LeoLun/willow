import type {
  GetWorkspaceListResponse,
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  DeleteWorkspaceRequest,
  DeleteWorkspaceResponse,
  GetWorkspaceInfoRequest,
  GetWorkspaceInfoResponse,
  GetWorkspaceFilesRequest,
  GetWorkspaceFilesResponse,
  GetWorkspaceSettingsRequest,
  GetWorkspaceSettingsResponse,
  RenameWorkspaceRequest,
  RenameWorkspaceResponse,
  UpdateWorkspaceSettingsRequest,
  UpdateWorkspaceSettingsResponse,
  ReadFileRequest,
  ReadFileResponse,
} from "../api";

export interface IWorkspaceApi {
  getWorkspaceList(): Promise<GetWorkspaceListResponse>;
  createWorkspace(request: CreateWorkspaceRequest): Promise<CreateWorkspaceResponse>;
  deleteWorkspace(request: DeleteWorkspaceRequest): Promise<DeleteWorkspaceResponse>;
  getWorkspaceInfo(request: GetWorkspaceInfoRequest): Promise<GetWorkspaceInfoResponse>;
  getWorkspaceFiles(request: GetWorkspaceFilesRequest): Promise<GetWorkspaceFilesResponse>;
  getWorkspaceSettings(request: GetWorkspaceSettingsRequest): Promise<GetWorkspaceSettingsResponse>;
  renameWorkspace(request: RenameWorkspaceRequest): Promise<RenameWorkspaceResponse>;
  updateWorkspaceSettings(
    request: UpdateWorkspaceSettingsRequest,
  ): Promise<UpdateWorkspaceSettingsResponse>;
  readFile(request: ReadFileRequest): Promise<ReadFileResponse>;
}
