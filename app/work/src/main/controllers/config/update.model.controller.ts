import { ConfigService } from "@main/service/config.service";
import type { ApiResponse, UpdateModelRequest, UpdateModelResponse } from "@shared/api";
import { UPDATE_MODEL } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class UpdateModelController extends IPCBaseController<
  UpdateModelRequest,
  UpdateModelResponse
> {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  @IPC(UPDATE_MODEL)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: UpdateModelRequest,
  ): Promise<ApiResponse<UpdateModelResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }
    try {
      const { id, ...data } = request;
      const model = this.configService.updateModel(id, data);
      if (!model) {
        return this.buildError(404, "model not found");
      }
      return this.buildResponse({ model });
    } catch (e) {
      return this.buildError(500, e instanceof Error ? e.message : String(e));
    }
  }

  checkParams(request: UpdateModelRequest): Error | undefined {
    if (!request?.id) return new Error("id is required");
    return undefined;
  }
}
