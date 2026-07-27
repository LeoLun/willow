import type { SearchFilesRequest, SearchFilesResponse } from "../api";

export interface IFileSearchApi {
  searchFiles(request: SearchFilesRequest): Promise<SearchFilesResponse>;
}
