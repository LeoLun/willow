import type {
  CreateAutomationRequest,
  CreateAutomationResponse,
  DeleteAutomationRequest,
  DeleteAutomationResponse,
  GetAutomationRequest,
  GetAutomationResponse,
  ListAutomationRunsRequest,
  ListAutomationRunsResponse,
  ListAutomationsRequest,
  ListAutomationsResponse,
  RunAutomationNowRequest,
  RunAutomationNowResponse,
  UpdateAutomationRequest,
  UpdateAutomationResponse,
} from "../api";

export interface IAutomationApi {
  listAutomations(request?: ListAutomationsRequest): Promise<ListAutomationsResponse>;
  getAutomation(request: GetAutomationRequest): Promise<GetAutomationResponse>;
  createAutomation(request: CreateAutomationRequest): Promise<CreateAutomationResponse>;
  updateAutomation(request: UpdateAutomationRequest): Promise<UpdateAutomationResponse>;
  deleteAutomation(request: DeleteAutomationRequest): Promise<DeleteAutomationResponse>;
  runAutomationNow(request: RunAutomationNowRequest): Promise<RunAutomationNowResponse>;
  listAutomationRuns(request: ListAutomationRunsRequest): Promise<ListAutomationRunsResponse>;
}
