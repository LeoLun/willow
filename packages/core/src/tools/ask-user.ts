import { Type } from "@sinclair/typebox";
import { createTool } from "./create-tool";
import type { ToolApprovalCoordinator } from "./tool-approval";

export interface AskUserToolDetails {
  question: string;
  options: string[];
  decision: "approved" | "rejected";
  answer?: string;
}

const askUserSchema = Type.Object({
  question: Type.String({
    description: "提示用户的具体问题",
  }),
  options: Type.Array(
    Type.String({
      description: "候选项内容",
    }),
    {
      minItems: 2,
      maxItems: 4,
      description: "供用户选择的 2~4 个候选项",
    },
  ),
});

export function createAskUserTool(approvalCoordinator: ToolApprovalCoordinator) {
  return createTool({
    name: "ask_user",
    label: "向用户提问",
    description:
      "向用户询问具体问题，获取用户的选择或自定义回答。当需要向用户补充/澄清信息时使用。",
    parameters: askUserSchema,
    meta: {
      label: "向用户提问",
      permission: () => ({ mode: "allow" }),
    },
    async execute(toolCallId, params, signal) {
      const result = await approvalCoordinator.requestApproval(
        {
          toolCallId,
          toolName: "ask_user",
          arguments: params,
          title: params.question,
          reason: "",
          risk: "medium",
        },
        signal,
      );

      const details: AskUserToolDetails = {
        question: params.question,
        options: params.options,
        decision: result.decision,
        answer: result.reason,
      };

      if (result.decision === "approved") {
        return {
          content: [{ type: "text", text: result.reason || "用户未提供具体回答" }],
          details,
        };
      } else {
        return {
          content: [{ type: "text", text: "用户跳过了该问题或未作答。" }],
          details,
        };
      }
    },
  });
}
