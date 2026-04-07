import { ConfigService } from "@main/service/config.service";
import type { ApiResponse, DeleteModelRequest, DeleteModelResponse } from "@shared/api";
import { DELETE_MODEL } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class DeleteModelController extends IPCBaseController<
  DeleteModelRequest,
  DeleteModelResponse
> {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  @IPC(DELETE_MODEL)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: DeleteModelRequest,
  ): Promise<ApiResponse<DeleteModelResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }
    try {
      const model = this.configService.deleteModel(request.id);
      if (!model) {
        return this.buildError(404, "model not found");
      }
      return this.buildResponse({ model });
    } catch (e) {
      return this.buildError(500, e instanceof Error ? e.message : String(e));
    }
  }

  checkParams(request: DeleteModelRequest): Error | undefined {
    if (!request?.id) return new Error("id is required");
    return undefined;
  }
}
