import type { ApiResponse, InspectLocalFilesRequest, InspectLocalFilesResponse } from "@shared/api";
import { INSPECT_LOCAL_FILES } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { LocalFileService } from "../../service/local-file.service";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class InspectLocalFilesController extends IPCBaseController<
  InspectLocalFilesRequest,
  InspectLocalFilesResponse
> {
  constructor(private readonly localFileService: LocalFileService) {
    super();
  }

  @IPC(INSPECT_LOCAL_FILES)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: InspectLocalFilesRequest,
  ): Promise<ApiResponse<InspectLocalFilesResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    return this.buildResponse({ files: await this.localFileService.inspect(request.paths) });
  }

  checkParams(request: InspectLocalFilesRequest): Error | undefined {
    if (!request || !Array.isArray(request.paths) || request.paths.length === 0) {
      return new Error("paths must be a non-empty array");
    }
    if (request.paths.some((path) => typeof path !== "string" || path.trim() === "")) {
      return new Error("paths must contain only non-empty strings");
    }
    return undefined;
  }
}
