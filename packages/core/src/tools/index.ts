import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createAskUserTool } from "./ask-user.js";
import { createBashTool } from "./bash.js";
import { createCreateAutomationTool } from "./create-automation.js";
import { createEditTool } from "./edit.js";
import { createFindTool } from "./find.js";
import { createGrepTool } from "./grep.js";
import { createLsTool } from "./ls.js";
import { createProcessListTool } from "./process-list.js";
import { createReadTool } from "./read.js";
import { createTodoListTool } from "./todo-list.js";
import type { ToolRuntimeOptions } from "./types.js";
import { createWebFetchTool } from "./webfetch.js";
import { createWebSearchTool } from "./websearch.js";
import { createWriteTool } from "./write.js";

export function createWillowTools(options: ToolRuntimeOptions): AgentTool[] {
  const tools: AgentTool[] = [
    createBashTool(options),
    createReadTool(options),
    createWriteTool(options),
    createEditTool(options),
    createLsTool(options),
    createGrepTool(options),
    createFindTool(options),
    createProcessListTool(options),
    createTodoListTool(options),
    createWebFetchTool(options),
  ];
  if (options.tavilyApiKey?.trim()) tools.push(createWebSearchTool(options));
  tools.push(createAskUserTool(options));
  tools.push(createCreateAutomationTool(options));
  return tools;
}

export * from "./base.js";
export * from "./ask-user.js";
export * from "./bash.js";
export * from "./create-automation.js";
export * from "./edit.js";
export * from "./find.js";
export * from "./grep.js";
export * from "./ls.js";
export * from "./policy.js";
export * from "./process-list.js";
export * from "./read.js";
export * from "./todo-list.js";
export * from "./types.js";
export * from "./webfetch.js";
export * from "./websearch.js";
export * from "./write.js";
