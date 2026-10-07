import type {
  MemoryFileRequest,
  SetMemoryEnabledRequest,
  SetMemoryEnabledResponse,
  OpenMemoryResponse,
  ReadMemoryResponse,
  SaveMemoryRequest,
  SaveMemoryResponse,
} from "../api";

export interface IMemoryApi {
  setMemoryEnabled(request: SetMemoryEnabledRequest): Promise<SetMemoryEnabledResponse>;
  saveMemory(request: SaveMemoryRequest): Promise<SaveMemoryResponse>;
  readMemory(request: MemoryFileRequest): Promise<ReadMemoryResponse>;
  openMemory(request: MemoryFileRequest): Promise<OpenMemoryResponse>;
}
