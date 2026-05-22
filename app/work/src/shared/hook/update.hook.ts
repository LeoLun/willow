import type { CheckUpdateResponse, StartDownloadResponse, InstallUpdateResponse } from "../api";

export interface IUpdateApi {
  checkUpdate(): Promise<CheckUpdateResponse>;
  startDownload(): Promise<StartDownloadResponse>;
  installUpdate(): Promise<InstallUpdateResponse>;
}
