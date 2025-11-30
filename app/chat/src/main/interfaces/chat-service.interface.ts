import { ChatOpenAICompletions } from "@langchain/openai";

export enum ChatServiceType {
  DEEPSEEK = "deepseek",
}

export interface IChatService {
  /**
   * 创建一个 ChatOpenAICompletions 实例
   * @returns ChatOpenAICompletions 实例
   */
  createChatAI(modelName?: string): any;

  /**
   * 获取一个 ChatOpenAICompletions 实例
   * @param chatid 必须提供一个 chatid
   * @returns 返回对应 chatid 的 ChatOpenAICompletions 实例
   */
  getChatAI(chatid: string): any;
}