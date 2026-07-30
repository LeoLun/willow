import { UserConfigService } from "@main/service/user-config.service";
import type {
  ApiResponse,
  ModelConfig,
  SetUserConfigRequest,
  SetUserConfigResponse,
} from "@shared/api";
import { SET_USER_CONFIG } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class SetUserConfigController extends IPCBaseController<
  SetUserConfigRequest,
  SetUserConfigResponse
> {
  constructor(private readonly userConfigService: UserConfigService) {
    super();
  }

  @IPC(SET_USER_CONFIG)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SetUserConfigRequest,
  ): Promise<ApiResponse<SetUserConfigResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    return this.buildResponse(await this.userConfigService.setConfig(request));
  }

  checkParams(request: SetUserConfigRequest): Error | undefined {
    if (!request || typeof request !== "object") {
      return new Error("request must be an object");
    }

    return (
      this.checkModel("largeModel", request.largeModel) ??
      this.checkModel("smallModel", request.smallModel)
    );
  }

  private checkModel(name: string, model: ModelConfig | undefined): Error | undefined {
    if (model === undefined) return undefined;
    if (!model || typeof model !== "object") return new Error(`${name} must be a model config`);
    if (typeof model.providerId !== "string" || model.providerId.trim() === "") {
      return new Error(`${name}.providerId must be a non-empty string`);
    }
    if (typeof model.modelId !== "string" || model.modelId.trim() === "") {
      return new Error(`${name}.modelId must be a non-empty string`);
    }
    return undefined;
  }
}
