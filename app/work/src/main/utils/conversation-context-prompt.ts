import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { extractPlainTextFromAgentMessage } from "./agent-message-text";

export const conversationContextSystemPrompt = `你是 Willow 的对话上下文压缩器，负责把无限对话流整理成可持续复用的长期上下文。

要求：
- 只根据输入内容总结，不要编造不存在的事实。
- 输出必须包含以下二级标题：
  ## 长期事实层
  ## 未闭环事项层
  ## 滚动摘要层
- 长期事实层只保留稳定、长期有效的偏好、约束、习惯、固定背景。
- 未闭环事项层只保留仍需继续跟进的问题、待办、验证项和开放决策。
- 滚动摘要层概括较早历史的关键阶段进展，避免流水账。
- 输出中文，路径、代码标识、命令和专有名词保留原文。
- 结果必须紧凑，避免无限增长；遇到重复内容时保留最新、最稳定、最关键的表述。`;

function formatMessage(message: AgentMessage, index: number): string {
  const role = typeof message.role === "string" ? message.role : "unknown";
  const text = extractPlainTextFromAgentMessage(message).trim();
  return `### ${index + 1}. ${role}\n${text || JSON.stringify(message)}`;
}

export function buildConversationContextPrompt(params: {
  previousContext?: string | null;
  messages: AgentMessage[];
}): string {
  const previousContext = params.previousContext?.trim();
  const history = params.messages.map(formatMessage).join("\n\n");

  return `${previousContext ? `下面是当前对话作用域已经存在的压缩状态。请将它与新增历史合并，并重写为一份新的紧凑状态，不要简单追加。\n\n# 既有压缩状态\n${previousContext}\n\n` : ""}# 需要纳入压缩的新增历史\n${history || "（无新增历史）"}\n\n请输出新的压缩状态。`;
}

export function extractConversationSection(summary: string, title: string) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = summary.match(new RegExp(`## ${escaped}\\s*([\\s\\S]*?)(?=\\n## |\\s*$)`));
  return match?.[1]?.trim() ?? "";
}

export function buildConversationCompressedContext(params: {
  summary: string;
  stableFacts?: string | null;
  openLoops?: string | null;
}) {
  const sections = [
    "以下是当前“对话”无限会话的只读长期上下文，用于帮助你在超长对话中保持连续性。",
    "",
    params.summary.trim(),
  ];

  const stableFacts = params.stableFacts?.trim();
  const openLoops = params.openLoops?.trim();

  if (stableFacts && !params.summary.includes("## 长期事实层")) {
    sections.push("", `## 长期事实层\n${stableFacts}`);
  }
  if (openLoops && !params.summary.includes("## 未闭环事项层")) {
    sections.push("", `## 未闭环事项层\n${openLoops}`);
  }

  return sections.join("\n");
}
