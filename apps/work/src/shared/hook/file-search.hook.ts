import type {
  ListWorkspaceDirectoryRequest,
  ListWorkspaceDirectoryResponse,
  OpenWorkspaceFileRequest,
  OpenWorkspaceFileResponse,
  ReadWorkspaceFileRequest,
  ReadWorkspaceFileResponse,
  RevealWorkspaceEntryRequest,
  RevealWorkspaceEntryResponse,
  SearchFilesRequest,
  SearchFilesResponse,
  SubscribeWorkspaceFilesRequest,
  SubscribeWorkspaceFilesResponse,
  UnsubscribeWorkspaceFilesRequest,
  UnsubscribeWorkspaceFilesResponse,
} from "../api";

export interface IFileSearchApi {
  listWorkspaceDirectory(
    request: ListWorkspaceDirectoryRequest,
  ): Promise<ListWorkspaceDirectoryResponse>;
  readWorkspaceFile(request: ReadWorkspaceFileRequest): Promise<ReadWorkspaceFileResponse>;
  openWorkspaceFile(request: OpenWorkspaceFileRequest): Promise<OpenWorkspaceFileResponse>;
  revealWorkspaceEntry(request: RevealWorkspaceEntryRequest): Promise<RevealWorkspaceEntryResponse>;
  searchFiles(request: SearchFilesRequest): Promise<SearchFilesResponse>;
  subscribeWorkspaceFiles(
    request: SubscribeWorkspaceFilesRequest,
  ): Promise<SubscribeWorkspaceFilesResponse>;
  unsubscribeWorkspaceFiles(
    request: UnsubscribeWorkspaceFilesRequest,
  ): Promise<UnsubscribeWorkspaceFilesResponse>;
}
