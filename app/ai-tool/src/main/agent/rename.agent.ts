import { createAgent } from "langchain";
import { ChatServiceFactory } from "../service/chat-service/chat-service.factory";
import { ChatServiceType } from "../interfaces/chat-service.interface";
import { registerFileTools } from "../ai-atom/tools/file.tool";
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

type RenameAgentResult = { filePath: string; recommendations: string[] }

export async function renameFileTool(filePath: string): Promise<RenameAgentResult> {
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

  const content = result.messages[result.messages.length - 1]?.content;
  const text = typeof content === 'string' ? content : JSON.stringify(content);

  // 兼容模型偶发的前后缀噪音：尝试截取第一个 JSON 数组
  const extractJsonArray = (s: string) => {
    const start = s.indexOf('[');
    const end = s.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return s;
    return s.slice(start, end + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonArray(text));
  } catch {
    // 再尝试把 ```json ``` 包裹去掉
    const cleaned = extractJsonArray(
      text
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim()
    );
    parsed = JSON.parse(cleaned) as unknown;
  }

  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  const recUnknown =
    first && typeof first === 'object' && 'recommendations' in (first as Record<string, unknown>)
      ? (first as Record<string, unknown>).recommendations
      : undefined;
  const recommendations = Array.isArray(recUnknown) ? recUnknown : [];
  const normalized = recommendations
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (!normalized.length) {
    throw new Error('AI 未返回可用的 recommendations');
  }

  return { filePath, recommendations: normalized };
}
