import type {
  GetMessageListRequest,
  GetMessageListResponse,
  SendMessageRequest,
  SendMessageResponse,
  StopMessageRequest,
  StopMessageResponse,
} from "../api";

export interface IMessageApi {
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  stopMessage(request: StopMessageRequest): Promise<StopMessageResponse>;
  getMessageList(request: GetMessageListRequest): Promise<GetMessageListResponse>;
}
