import { CredentialService } from "@main/service/credential.service";
import type {
  ApiResponse,
  GetConfiguredProvidersRequest,
  GetConfiguredProvidersResponse,
} from "@shared/api";
import { GET_CONFIGURED_PROVIDERS } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetConfiguredProvidersController extends IPCBaseController<
  GetConfiguredProvidersRequest,
  GetConfiguredProvidersResponse
> {
  constructor(private readonly credentialService: CredentialService) {
    super();
  }

  @IPC(GET_CONFIGURED_PROVIDERS)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    _request: GetConfiguredProvidersRequest,
  ): Promise<ApiResponse<GetConfiguredProvidersResponse>> {
    return this.buildResponse({
      providerIds: this.credentialService.getConfiguredProviderIds(),
    });
  }

  checkParams(_request: GetConfiguredProvidersRequest): Error | undefined {
    return undefined;
  }
}
