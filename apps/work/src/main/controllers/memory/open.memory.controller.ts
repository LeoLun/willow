import { MemoryService } from "@main/service/memory.service";
import type { ApiResponse, MemoryFileRequest, OpenMemoryResponse } from "@shared/api";
import { OPEN_MEMORY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkMemoryRequest } from "./memory-controller.params";

@Injectable()
export class OpenMemoryController extends IPCBaseController<MemoryFileRequest, OpenMemoryResponse> {
  constructor(private readonly memoryService: MemoryService) {
    super();
  }
  @IPC(OPEN_MEMORY)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: MemoryFileRequest,
  ): Promise<ApiResponse<OpenMemoryResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    await this.memoryService.open(request);
    return this.buildResponse({});
  }
  checkParams(request: MemoryFileRequest): Error | undefined {
    return checkMemoryRequest(request);
  }
}
