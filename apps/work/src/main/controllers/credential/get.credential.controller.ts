import { CredentialService } from "@main/service/credential.service";
import type { ApiResponse, GetCredentialRequest, GetCredentialResponse } from "@shared/api";
import { GET_CREDENTIAL } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetCredentialController extends IPCBaseController<
  GetCredentialRequest,
  GetCredentialResponse
> {
  constructor(private readonly credentialService: CredentialService) {
    super();
  }

  @IPC(GET_CREDENTIAL)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetCredentialRequest,
  ): Promise<ApiResponse<GetCredentialResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const credential = await this.credentialService.getCredential(request.providerId);
    return this.buildResponse({ configured: credential?.type === "api_key" });
  }

  checkParams(request: GetCredentialRequest): Error | undefined {
    if (!request || typeof request.providerId !== "string" || request.providerId.trim() === "") {
      return new Error("providerId must be a non-empty string");
    }
    return undefined;
  }
}
