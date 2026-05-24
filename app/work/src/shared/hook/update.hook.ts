import type { CheckUpdateResponse, StartDownloadResponse, InstallUpdateResponse } from "../api";

export interface IUpdateApi {
  checkUpdate(request?: { force?: boolean }): Promise<CheckUpdateResponse>;
  startDownload(): Promise<StartDownloadResponse>;
  installUpdate(): Promise<InstallUpdateResponse>;
}
