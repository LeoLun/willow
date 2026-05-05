import type { Agent } from "@mariozechner/pi-agent-core";
import { loadSkills } from "./skills";
import { buildSystemPrompt, type SystemPromptOptions } from "./system-prompt";
import {
  createAllTools,
  type CreateAllToolsOptions,
  ToolApprovalCoordinator,
  type WebSearchOptions,
  type WillowTool,
} from "./tools/index";
import type { TodoStore } from "./tools/todo-store";

export interface CoreAgentOptions {
  cwd: string;
  agentDir?: string;
  userData?: string;
  customInstructions?: string;
  projectContext?: string;
  compressedContext?: string;
  websearch?: WebSearchOptions;
  todoStore?: TodoStore;
  extraTools?: WillowTool<any>[];
}

export class CoreAgent {
  readonly agent: Agent;
  readonly cwd: string;
  readonly approvalCoordinator: ToolApprovalCoordinator;
  readonly tools: WillowTool<any>[];

  constructor(agent: Agent, options: CoreAgentOptions) {
    this.agent = agent;
    this.cwd = options.cwd;
    this.approvalCoordinator = new ToolApprovalCoordinator();

    const toolOptions: CreateAllToolsOptions = {
      websearch: options.websearch,
      todoStore: options.todoStore,
      extraTools: options.extraTools,
    };
    const tools = createAllTools(this.cwd, toolOptions);
    this.tools = tools;
    const { skills, userDir, projectDir } = loadSkills({
      cwd: this.cwd,
      agentDir: options.agentDir,
      userData: options.userData,
    });

    const promptOptions: SystemPromptOptions = {
      cwd: this.cwd,
      userDir,
      projectDir,
      toolNames: tools.map((t) => t.name),
      skills,
      customInstructions: options.customInstructions,
      projectContext: options.projectContext,
      compressedContext: options.compressedContext,
    };

    this.agent.setSystemPrompt(buildSystemPrompt(promptOptions));
    this.agent.setTools(tools);
    this.agent.setBeforeToolCall(async ({ toolCall, args }, signal) => {
      const tool = this.tools.find((item) => item.name === toolCall.name);
      const decision = tool?.meta.permission?.(args as never) ?? { mode: "allow" as const };

      if (decision.mode === "allow") {
        return undefined;
      }

      const result = await this.approvalCoordinator.requestApproval(
        {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          arguments: args,
          reason: decision.reason,
          risk: decision.risk,
        },
        signal,
      );

      if (result === "approved") {
        return undefined;
      }

      return {
        block: true,
        reason: "用户拒绝了本次工具调用",
      };
    });
  }

  resolveToolApproval(toolCallId: string, decision: "approved" | "rejected"): boolean {
    return this.approvalCoordinator.resolve(toolCallId, decision);
  }
}
