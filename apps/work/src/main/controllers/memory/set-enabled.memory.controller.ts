import { MemoryService } from "@main/service/memory.service";
import type { ApiResponse, SetMemoryEnabledRequest, SetMemoryEnabledResponse } from "@shared/api";
import { SET_MEMORY_ENABLED } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class SetMemoryEnabledController extends IPCBaseController<
  SetMemoryEnabledRequest,
  SetMemoryEnabledResponse
> {
  constructor(private readonly memoryService: MemoryService) {
    super();
  }
  @IPC(SET_MEMORY_ENABLED)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SetMemoryEnabledRequest,
  ): Promise<ApiResponse<SetMemoryEnabledResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    await this.memoryService.setEnabled(request.enabled);
    return this.buildResponse({ enabled: request.enabled });
  }
  checkParams(request: SetMemoryEnabledRequest): Error | undefined {
    if (
      !request ||
      typeof request !== "object" ||
      Array.isArray(request) ||
      typeof request.enabled !== "boolean" ||
      Object.keys(request).some((key) => key !== "enabled")
    )
      return new Error("Invalid memory switch request");
    return undefined;
  }
}
