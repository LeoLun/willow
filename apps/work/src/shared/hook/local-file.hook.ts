import type {
  InspectLocalFilesRequest,
  InspectLocalFilesResponse,
  SelectLocalFilesRequest,
  SelectLocalFilesResponse,
} from "../api";

export interface ILocalFileApi {
  selectLocalFiles(request?: SelectLocalFilesRequest): Promise<SelectLocalFilesResponse>;
  inspectLocalFiles(request: InspectLocalFilesRequest): Promise<InspectLocalFilesResponse>;
  getPathForFile(file: File): string;
}
