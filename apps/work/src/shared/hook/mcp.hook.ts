import type { GetMcpRequest, GetMcpResponse, ManageMcpRequest, ManageMcpResponse } from "../api";
export interface IMcpApi {
  getMcp(request: GetMcpRequest): Promise<GetMcpResponse>;
  manageMcp(request: ManageMcpRequest): Promise<ManageMcpResponse>;
}
