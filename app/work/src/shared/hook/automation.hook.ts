import type {
  CreateAutomationRequest,
  CreateAutomationResponse,
  DeleteAutomationRequest,
  DeleteAutomationResponse,
  GetAutomationListResponse,
  GetAutomationRequest,
  GetAutomationResponse,
  RunAutomationNowRequest,
  RunAutomationNowResponse,
  UpdateAutomationRequest,
  UpdateAutomationResponse,
} from "../api";

export interface IAutomationApi {
  getAutomationList(): Promise<GetAutomationListResponse>;
  getAutomation(request: GetAutomationRequest): Promise<GetAutomationResponse>;
  createAutomation(request: CreateAutomationRequest): Promise<CreateAutomationResponse>;
  updateAutomation(request: UpdateAutomationRequest): Promise<UpdateAutomationResponse>;
  runAutomationNow(request: RunAutomationNowRequest): Promise<RunAutomationNowResponse>;
  deleteAutomation(request: DeleteAutomationRequest): Promise<DeleteAutomationResponse>;
}
