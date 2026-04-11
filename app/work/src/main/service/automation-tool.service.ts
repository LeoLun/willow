import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import { createTool, type WillowTool } from "@willow/core";
import type { AutomationService } from "./automation.service";

const automationTriggerSchema = Type.Object({
  type: Type.Literal("schedule"),
  cronExpression: Type.String({ description: "标准 cron 表达式" }),
  timezone: Type.Optional(Type.String({ description: "IANA 时区，例如 Asia/Shanghai" })),
});

const automationCreateSchema = Type.Object({
  workspaceId: Type.Number({ description: "工作空间 ID" }),
  prompt: Type.String({ description: "自动化执行时发送给 AI 的提示词" }),
  trigger: automationTriggerSchema,
  status: Type.Optional(Type.Union([Type.Literal("enabled"), Type.Literal("disabled")])),
});

const automationUpdateSchema = Type.Object({
  id: Type.Number({ description: "自动化 ID" }),
  prompt: Type.Optional(Type.String({ description: "新的自动化提示词" })),
  trigger: Type.Optional(automationTriggerSchema),
  status: Type.Optional(Type.Union([Type.Literal("enabled"), Type.Literal("disabled")])),
});

const automationIdSchema = Type.Object({
  id: Type.Number({ description: "自动化 ID" }),
});

let automationServiceRef: AutomationService | null = null;

function getAutomationService() {
  if (!automationServiceRef) {
    throw new Error("automation tools not initialized");
  }
  return automationServiceRef;
}

function toTextPayload(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
    details: data,
  };
}

export function registerAutomationToolService(service: AutomationService) {
  automationServiceRef = service;
}

export function createAutomationTools(): WillowTool<any>[] {
  return [
    createTool({
      name: "automation_list",
      label: "查询自动化列表",
      description: "列出当前所有自动化配置及最近一次运行摘要。",
      parameters: Type.Object({}),
      meta: {
        label: "查询自动化列表",
        permission: () => ({ mode: "allow" }),
      },
      execute: async () => {
        const automations = getAutomationService().listAutomations();
        return toTextPayload({ automations });
      },
    }),
    createTool({
      name: "automation_get",
      label: "查询单个自动化",
      description: "根据自动化 ID 查询详细配置。",
      parameters: automationIdSchema,
      meta: {
        label: "查询单个自动化",
        permission: () => ({ mode: "allow" }),
      },
      execute: async (_toolCallId, params: Static<typeof automationIdSchema>) => {
        const automation = getAutomationService().getAutomation(params.id);
        return toTextPayload({ automation });
      },
    }),
    createTool({
      name: "automation_create",
      label: "创建自动化",
      description: "创建一条新的定时自动化。",
      parameters: automationCreateSchema,
      meta: {
        label: "创建自动化",
        permission: () => ({ mode: "allow" }),
      },
      execute: async (_toolCallId, params: Static<typeof automationCreateSchema>) => {
        const automation = getAutomationService().createAutomation(params);
        return toTextPayload({ automation });
      },
    }),
    createTool({
      name: "automation_update",
      label: "更新自动化",
      description: "更新自动化的提示词、状态或 cron 配置。",
      parameters: automationUpdateSchema,
      meta: {
        label: "更新自动化",
        permission: () => ({ mode: "allow" }),
      },
      execute: async (_toolCallId, params: Static<typeof automationUpdateSchema>) => {
        const automation = getAutomationService().updateAutomation(params.id, {
          prompt: params.prompt,
          trigger: params.trigger,
          status: params.status,
        });
        return toTextPayload({ automation });
      },
    }),
    createTool({
      name: "automation_delete",
      label: "删除自动化",
      description: "根据 ID 删除自动化。",
      parameters: automationIdSchema,
      meta: {
        label: "删除自动化",
        permission: () => ({ mode: "allow" }),
      },
      execute: async (_toolCallId, params: Static<typeof automationIdSchema>) => {
        const automation = getAutomationService().deleteAutomation(params.id);
        return toTextPayload({ automation });
      },
    }),
  ];
}
