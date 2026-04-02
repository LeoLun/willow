import type { AgentTool } from "@mariozechner/pi-agent-core";
import { createBashTool } from "./bash";
import { createEditTool } from "./edit";
import { createFindTool } from "./find";
import { createGrepTool } from "./grep";
import { createLsTool } from "./ls";
import { createReadTool } from "./read";
import type { TodoStore } from "./todo-store";
import { createTodoReadTool } from "./todoread";
import { createTodoWriteTool } from "./todowrite";
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
  createTodoReadTool,
  createTodoWriteTool,
  createWebFetchTool,
  createWebSearchTool,
  createWriteTool,
};

export type { TodoItem, TodoStore } from "./todo-store";

export interface WebSearchOptions {
  getApiKey: () => string;
}

export function createAllTools(cwd: string, websearch?: WebSearchOptions, todoStore?: TodoStore) {
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

  if (todoStore) {
    tools.push(createTodoWriteTool(todoStore));
    tools.push(createTodoReadTool(todoStore));
  }

  return tools;
}
