import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import { createTool } from "@willow/core";

export const workspaceDelegateSchema = Type.Object({
  workspaceId: Type.Number({ description: "目标工作空间的 ID" }),
  task: Type.String({ description: "指派给子 Agent 的任务内容" }),
  sessionId: Type.Optional(Type.Number({ description: "要复用或追加对话 of 子会话 ID (可选)" })),
});

export function createWorkspaceDelegateTool(
  parentSessionId: number,
  handler: (params: {
    workspaceId: number;
    task: string;
    sessionId?: number;
    toolCallId: string;
    parentSessionId: number;
  }) => Promise<any>,
) {
  return createTool({
    name: "workspace_delegate",
    label: "委派工作空间",
    description:
      "将具体开发或分析任务委派给对应工作空间下的子 Agent。执行时间可能较长，执行结果会自动回调返回给主 Agent。",
    parameters: workspaceDelegateSchema,
    meta: {
      label: "委派工作空间",
    },
    async execute(toolCallId, params: Static<typeof workspaceDelegateSchema>) {
      return handler({
        ...params,
        toolCallId,
        parentSessionId,
      });
    },
  }) as any;
}
