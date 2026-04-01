import type { AgentTool } from "@mariozechner/pi-agent-core";
import { createBashTool } from "./bash";
import { createEditTool } from "./edit";
import { createFindTool } from "./find";
import { createGrepTool } from "./grep";
import { createLsTool } from "./ls";
import { createReadTool } from "./read";
import { createWebFetchTool } from "./webfetch";
import { createWebSearchTool } from "./websearch";
import { createWriteTool } from "./write";

export {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWebFetchTool,
  createWebSearchTool,
  createWriteTool,
};

export interface WebSearchOptions {
  getApiKey: () => string;
}

export function createAllTools(cwd: string, websearch?: WebSearchOptions) {
  const tools: AgentTool<any>[] = [
    createBashTool(cwd),
    createEditTool(cwd),
    createFindTool(cwd),
    createGrepTool(cwd),
    createLsTool(cwd),
    createReadTool(cwd),
    createWebFetchTool(),
    createWriteTool(cwd),
  ];

  if (websearch) {
    tools.push(createWebSearchTool(websearch.getApiKey));
  }

  return tools;
}
