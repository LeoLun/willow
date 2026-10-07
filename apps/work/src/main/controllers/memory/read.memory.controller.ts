import { MemoryService } from "@main/service/memory.service";
import type { ApiResponse, MemoryFileRequest, ReadMemoryResponse } from "@shared/api";
import { READ_MEMORY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkMemoryRequest } from "./memory-controller.params";

@Injectable()
export class ReadMemoryController extends IPCBaseController<MemoryFileRequest, ReadMemoryResponse> {
  constructor(private readonly memoryService: MemoryService) {
    super();
  }
  @IPC(READ_MEMORY)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: MemoryFileRequest,
  ): Promise<ApiResponse<ReadMemoryResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    return this.buildResponse({ memory: await this.memoryService.read(request) });
  }
  checkParams(request: MemoryFileRequest): Error | undefined {
    return checkMemoryRequest(request);
  }
}
