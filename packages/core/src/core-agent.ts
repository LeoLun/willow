import type { Agent } from "@mariozechner/pi-agent-core";
import { loadSkills } from "./skills";
import { buildSystemPrompt, type SystemPromptOptions } from "./system-prompt";
import { createAllTools } from "./tools/index";

export interface CoreAgentOptions {
  cwd: string;
  agentDir?: string;
  userData?: string;
  customInstructions?: string;
  projectContext?: string;
}

export class CoreAgent {
  readonly agent: Agent;
  readonly cwd: string;

  constructor(agent: Agent, options: CoreAgentOptions) {
    this.agent = agent;
    this.cwd = options.cwd;

    const tools = createAllTools(this.cwd);
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
    };

    this.agent.setSystemPrompt(buildSystemPrompt(promptOptions));
    this.agent.setTools(tools);
  }
}
