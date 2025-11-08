import { Injectable } from "poetry";
import { ChatDeepSeek } from "@langchain/deepseek";
import { IChatService } from "../../interfaces/chat-service.interface";

@Injectable()
export class DSChatService implements IChatService {

  createChatAI() {
    const model = new ChatDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY,
      modelName: "deepseek-chat",
      streaming: true,
    });

    return model
  }

  getChatAI(chatid: string) {
    return this.createChatAI();
  }
}
