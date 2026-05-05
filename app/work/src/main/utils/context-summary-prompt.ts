import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { extractPlainTextFromAgentMessage } from "./agent-message-text";

export const contextSummarySystemPrompt = `你是 Willow 的会话上下文压缩器。你的任务是把较早聊天历史压缩成可供后续 AI 助手参考的中文上下文摘要。

要求：
- 只根据输入历史总结，不要编造未出现的事实。
- 保留具体文件路径、模块名、配置值、命令结论、错误信息、用户明确偏好和开放问题。
- 丢弃寒暄、重复确认、已过期的中间状态。
- 输出 Markdown，且必须包含这些二级标题：
  ## 已压缩的历史摘要
  ## 关键决策与事实
  ## 已完成操作
  ## 待跟进事项
  ## 索引
- 除路径、代码标识和专有名词外，使用中文。`;

function formatMessageForSummary(message: AgentMessage, index: number): string {
  const role = typeof message.role === "string" ? message.role : "unknown";
  const text = extractPlainTextFromAgentMessage(message).trim();
  const readable = text || JSON.stringify(message);
  return `### ${index + 1}. ${role}\n${readable}`;
}

export function buildContextSummaryPrompt(params: {
  previousSummary?: string | null;
  messages: AgentMessage[];
}): string {
  const previousSummary = params.previousSummary?.trim();
  const history = params.messages.map(formatMessageForSummary).join("\n\n");

  return `${previousSummary ? `下面是已有摘要，请把它与新增历史合并成一份最新摘要，不要简单追加重复内容。\n\n# 旧摘要\n${previousSummary}\n\n` : ""}# 需要压缩的新增历史\n${history || "（无新增历史）"}\n\n请输出合并后的最新摘要。`;
}

export function extractIndexSection(summary: string): string {
  const match = summary.match(/## 索引\s*([\s\S]*?)(?=\n## |\s*$)/);
  return match?.[1]?.trim() ?? "";
}

export function buildCompressedContext(summary: string, indexText?: string | null): string {
  const index = indexText?.trim();
  return `以下是较早会话历史的压缩摘要。它不是新的用户请求，而是帮助你保持连续工作的只读背景。\n\n${summary.trim()}${index ? `\n\n## 压缩索引摘录\n${index}` : ""}`;
}
