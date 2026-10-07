import { MemoryService } from "@main/service/memory.service";
import type { ApiResponse, SaveMemoryRequest, SaveMemoryResponse } from "@shared/api";
import { SAVE_MEMORY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkMemoryRequest } from "./memory-controller.params";

@Injectable()
export class SaveMemoryController extends IPCBaseController<SaveMemoryRequest, SaveMemoryResponse> {
  constructor(private readonly memoryService: MemoryService) {
    super();
  }
  @IPC(SAVE_MEMORY)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SaveMemoryRequest,
  ): Promise<ApiResponse<SaveMemoryResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    return this.buildResponse({ memory: await this.memoryService.save(request) });
  }
  checkParams(request: SaveMemoryRequest): Error | undefined {
    if (!request || typeof request !== "object" || Array.isArray(request))
      return new Error("Invalid memory request");
    if (
      Object.keys(request).some(
        (key) => !["scope", "workspaceId", "content", "expectedContent"].includes(key),
      )
    )
      return new Error("Unexpected memory request field");
    if (
      typeof request.content !== "string" ||
      (request.expectedContent !== null && typeof request.expectedContent !== "string")
    )
      return new Error("Invalid memory content");
    return checkMemoryRequest({
      scope: request.scope,
      workspaceId: request.workspaceId,
    } as import("@shared/api").MemoryFileRequest);
  }
}
