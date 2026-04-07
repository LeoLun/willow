import { ConfigService } from "@main/service/config.service";
import type { AddModelRequest, AddModelResponse, ApiResponse } from "@shared/api";
import { ADD_MODEL } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class AddModelController extends IPCBaseController<AddModelRequest, AddModelResponse> {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  @IPC(ADD_MODEL)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: AddModelRequest,
  ): Promise<ApiResponse<AddModelResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }
    try {
      const model = this.configService.addModel(request);
      return this.buildResponse({ model });
    } catch (e) {
      return this.buildError(500, e instanceof Error ? e.message : String(e));
    }
  }

  checkParams(request: AddModelRequest): Error | undefined {
    if (!request?.modelId) return new Error("modelId is required");
    if (!request?.name) return new Error("name is required");
    if (!request?.api) return new Error("api is required");
    if (!request?.provider) return new Error("provider is required");
    if (!request?.baseUrl) return new Error("baseUrl is required");
    return undefined;
  }
}
