import { CredentialService } from "@main/service/credential.service";
import type { ApiResponse, SetCredentialRequest, SetCredentialResponse } from "@shared/api";
import { SET_CREDENTIAL } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class SetCredentialController extends IPCBaseController<
  SetCredentialRequest,
  SetCredentialResponse
> {
  constructor(private readonly credentialService: CredentialService) {
    super();
  }

  @IPC(SET_CREDENTIAL)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SetCredentialRequest,
  ): Promise<ApiResponse<SetCredentialResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    await this.credentialService.setCredential(request.providerId, {
      type: "api_key",
      key: request.apiKey,
    });
    return this.buildResponse({});
  }

  checkParams(request: SetCredentialRequest): Error | undefined {
    if (!request || typeof request.providerId !== "string" || request.providerId.trim() === "") {
      return new Error("providerId must be a non-empty string");
    }
    if (typeof request.apiKey !== "string" || request.apiKey.trim() === "") {
      return new Error("apiKey must be a non-empty string");
    }
    return undefined;
  }
}
