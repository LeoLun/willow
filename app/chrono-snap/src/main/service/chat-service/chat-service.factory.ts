import { IChatService, ChatServiceType } from '../../interfaces/chat-service.interface';
import { DSChatService } from './ds-chat.service';

/**
 * ChatService工厂类，用于根据不同的类型创建对应的ChatService实例
 */
export class ChatServiceFactory {
  /**
   * 根据类型创建ChatService实例
   * @param type chat service类型
   * @returns 对应的ChatService实例
   */
  static createChatService(type: ChatServiceType): IChatService {
    switch (type) {
      case ChatServiceType.DEEPSEEK:
        return new DSChatService();
      // 后续可以根据需要添加更多的chat service类型
      // case ChatServiceType.OPENAI:
      //   return new OpenAIChatService();
      default:
        throw new Error(`Unsupported chat service type: ${type}`);
    }
  }
}