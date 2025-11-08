import { createAgent } from "langchain";
import { ChatServiceFactory } from "../service/chat-service/chat-service.factory";
import { ChatServiceType } from "../interfaces/chat-service.interface";
import { registerFileTools } from "../tools/file.tool";
import { prompt } from '../prompt/rename.prompt'

const systemPrompt = `
你是一个智能文件命名助手。你的任务：根据文件路径及文件内容，生成简短、语义明确的文件名建议（不含扩展名）。

规则：
1. 文件名长度 ≤ 6 个词，推荐 2~4 个词。
2. 使用小写字母和中划线（kebab-case），避免空格和特殊字符。
3. 避免在文件名中包含个人敏感信息（如身份证号、信用卡号、手机号等）。如果内容包含敏感信息，请标记为 "INSUFFICIENT_CONTENT"，并生成安全通用命名。
4. 如果文件是会议记录或笔记，可包含日期（YYYY-MM-DD）。
5. 如果文件是报告或总结，可包含简短描述词如 "report"、"summary"。
6. 输出每个建议的理由（不超过 20 个字）。
7. 如果内容不足以生成合适文件名，返回 "INSUFFICIENT_CONTENT"，并说明缺失原因。
8. 返回 JSON 数组格式，不要返回其他文本。
`;

export async function renameFileTool(filePath: string) {
  console.log('renameFileTool', filePath)
  const chatServiceImpl = ChatServiceFactory.createChatService(ChatServiceType.DEEPSEEK);
  const model = chatServiceImpl.createChatAI();

  const agent = createAgent({
    name: "renameAgent",
    model,
    description: "重命名文件或文件夹",
    systemPrompt: systemPrompt,
    tools: [...registerFileTools()],
  });

  // 实现重命名文件或文件夹的逻辑
  const formattedMessages = await prompt.format({
    filePath: filePath,
    fileName: filePath.split("/").pop() || "",
  });

  const result = await agent.invoke({
    messages: formattedMessages,
  });

  console.log("AI 输出结果：", result);
}
