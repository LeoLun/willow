import type {
  AppUpdateRequest,
  AppUpdateResponse,
  OpenManualUpdateResponse,
  RestartToUpdateResponse,
} from "../api";

export interface IAppUpdateApi {
  getUpdateState(request?: AppUpdateRequest): Promise<AppUpdateResponse>;
  checkForUpdate(request?: AppUpdateRequest): Promise<AppUpdateResponse>;
  downloadUpdate(request?: AppUpdateRequest): Promise<AppUpdateResponse>;
  restartToUpdate(request?: AppUpdateRequest): Promise<RestartToUpdateResponse>;
  openManualUpdate(request?: AppUpdateRequest): Promise<OpenManualUpdateResponse>;
  confirmUpdateBoot(request?: AppUpdateRequest): Promise<AppUpdateResponse>;
}
