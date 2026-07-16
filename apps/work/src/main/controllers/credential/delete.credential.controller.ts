import { CredentialService } from "@main/service/credential.service";
import type { ApiResponse, DeleteCredentialRequest, DeleteCredentialResponse } from "@shared/api";
import { DELETE_CREDENTIAL } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class DeleteCredentialController extends IPCBaseController<
  DeleteCredentialRequest,
  DeleteCredentialResponse
> {
  constructor(private readonly credentialService: CredentialService) {
    super();
  }

  @IPC(DELETE_CREDENTIAL)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: DeleteCredentialRequest,
  ): Promise<ApiResponse<DeleteCredentialResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    await this.credentialService.deleteCredential(request.providerId);
    return this.buildResponse({});
  }

  checkParams(request: DeleteCredentialRequest): Error | undefined {
    if (!request || typeof request.providerId !== "string" || request.providerId.trim() === "") {
      return new Error("providerId must be a non-empty string");
    }
    return undefined;
  }
}
