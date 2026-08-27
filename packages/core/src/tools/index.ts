import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createAskUserTool } from "./ask-user.js";
import { createBashTool } from "./bash.js";
import { createCreateAutomationTool } from "./create-automation.js";
import { createDeleteAutomationTool } from "./delete-automation.js";
import { createEditTool } from "./edit.js";
import { createFindTool } from "./find.js";
import { createGrepTool } from "./grep.js";
import { createListAutomationsTool } from "./list-automations.js";
import { createLsTool } from "./ls.js";
import { createReadTool } from "./read.js";
import { createTodoListTool } from "./todo-list.js";
import type { ToolRuntimeOptions } from "./types.js";
import { createUpdateAutomationTool } from "./update-automation.js";
import { createUpdatePlanTool } from "./update-plan.js";
import { createWebFetchTool } from "./webfetch.js";
import { createWebSearchTool } from "./websearch.js";
import { createWritePlanTool } from "./write-plan.js";
import { createWriteTool } from "./write.js";

export function createWillowTools(options: ToolRuntimeOptions): AgentTool[] {
  if (options.agentMode === "plan") {
    const tools: AgentTool[] = [
      createReadTool(options),
      createLsTool(options),
      createGrepTool(options),
      createFindTool(options),
      createWebFetchTool(options),
    ];
    if (options.tavilyApiKey?.trim()) tools.push(createWebSearchTool(options));
    tools.push(createAskUserTool(options));
    tools.push(createWritePlanTool(options));
    tools.push(createUpdatePlanTool(options));
    return tools;
  }

  const tools: AgentTool[] = [
    createBashTool(options),
    createReadTool(options),
    createWriteTool(options),
    createEditTool(options),
    createLsTool(options),
    createGrepTool(options),
    createFindTool(options),
    createTodoListTool(options),
    createWebFetchTool(options),
  ];
  if (options.tavilyApiKey?.trim()) tools.push(createWebSearchTool(options));
  tools.push(createAskUserTool(options));
  tools.push(createListAutomationsTool(options));
  tools.push(createCreateAutomationTool(options));
  tools.push(createUpdateAutomationTool(options));
  tools.push(createDeleteAutomationTool(options));
  return tools;
}

export * from "./base.js";
export * from "./ask-user.js";
export * from "./bash.js";
export * from "./create-automation.js";
export * from "./delete-automation.js";
export * from "./edit.js";
export * from "./find.js";
export * from "./grep.js";
export * from "./ls.js";
export * from "./list-automations.js";
export * from "./directory-access.js";
export * from "./escalation-store.js";
export * from "./permission-engine.js";
export * from "./policy.js";
export * from "./read.js";
export * from "./todo-list.js";
export * from "./update-automation.js";
export * from "./update-plan.js";
export * from "./types.js";
export * from "./webfetch.js";
export * from "./websearch.js";
export * from "./write.js";
export * from "./write-plan.js";
