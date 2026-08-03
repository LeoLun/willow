import type {
  GetMessageListRequest,
  GetMessageListResponse,
  SendMessageRequest,
  SendMessageResponse,
  ResolveToolApprovalRequest,
  ResolveToolApprovalResponse,
  ResolveUserQuestionRequest,
  ResolveUserQuestionResponse,
  StopMessageRequest,
  StopMessageResponse,
} from "../api";

export interface IMessageApi {
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  stopMessage(request: StopMessageRequest): Promise<StopMessageResponse>;
  getMessageList(request: GetMessageListRequest): Promise<GetMessageListResponse>;
  resolveToolApproval(request: ResolveToolApprovalRequest): Promise<ResolveToolApprovalResponse>;
  resolveUserQuestion(request: ResolveUserQuestionRequest): Promise<ResolveUserQuestionResponse>;
}
