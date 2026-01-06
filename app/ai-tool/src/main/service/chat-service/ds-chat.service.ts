import { Injectable } from "poetry";
import { ChatDeepSeek } from "@langchain/deepseek";
import { IChatService } from "../../interfaces/chat-service.interface";

@Injectable()
export class DSChatService implements IChatService {

  createChatAI(modelName: "deepseek-chat" | "deepseek-reasoner" = "deepseek-chat") {
    const model = new ChatDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY,
      modelName,
      streaming: true,
    });

    return model
  }

  getChatAI(chatid: string) {
    return this.createChatAI();
  }
}
