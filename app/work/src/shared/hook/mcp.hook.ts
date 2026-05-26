import type {
  GetMcpServersRequest,
  GetMcpServersResponse,
  AddMcpServerRequest,
  AddMcpServerResponse,
  UpdateMcpServerRequest,
  UpdateMcpServerResponse,
  DeleteMcpServerRequest,
  DeleteMcpServerResponse,
  ToggleMcpServerRequest,
  ToggleMcpServerResponse,
} from "../api";

export interface IMcpApi {
  getMcpServers(request: GetMcpServersRequest): Promise<GetMcpServersResponse>;
  addMcpServer(request: AddMcpServerRequest): Promise<AddMcpServerResponse>;
  updateMcpServer(request: UpdateMcpServerRequest): Promise<UpdateMcpServerResponse>;
  deleteMcpServer(request: DeleteMcpServerRequest): Promise<DeleteMcpServerResponse>;
  toggleMcpServer(request: ToggleMcpServerRequest): Promise<ToggleMcpServerResponse>;
}
