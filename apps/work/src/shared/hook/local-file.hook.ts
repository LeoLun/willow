import type {
  InspectLocalFilesRequest,
  InspectLocalFilesResponse,
  PersistClipboardImagesRequest,
  PersistClipboardImagesResponse,
  SelectLocalFilesRequest,
  SelectLocalFilesResponse,
} from "../api";

export interface ILocalFileApi {
  selectLocalFiles(request?: SelectLocalFilesRequest): Promise<SelectLocalFilesResponse>;
  inspectLocalFiles(request: InspectLocalFilesRequest): Promise<InspectLocalFilesResponse>;
  persistClipboardImages(
    request: PersistClipboardImagesRequest,
  ): Promise<PersistClipboardImagesResponse>;
  getPathForFile(file: File): string;
}
