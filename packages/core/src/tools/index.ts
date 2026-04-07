import { createBashTool } from "./bash";
import { createTool, type WillowTool, type ToolPermissionDecision } from "./create-tool";
import { createEditTool } from "./edit";
import { createFindTool } from "./find";
import { createGrepTool } from "./grep";
import { createLsTool } from "./ls";
import { createReadTool } from "./read";
import type { TodoStore } from "./todo-store";
import { createTodoReadTool } from "./todoread";
import { createTodoWriteTool } from "./todowrite";
import { ToolApprovalCoordinator } from "./tool-approval";
import { createWebFetchTool } from "./webfetch";
import { createWebSearchTool } from "./websearch";
import { createWriteTool } from "./write";

export {
  createBashTool,
  createTool,
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
  ToolApprovalCoordinator,
};

export type { TodoItem, TodoStore } from "./todo-store";
export type { WillowTool, ToolPermissionDecision } from "./create-tool";
export type {
  ToolApprovalRequest,
  ToolApprovalDecision,
  ToolApprovalStatus,
} from "./tool-approval";

export interface WebSearchOptions {
  getApiKey: () => string;
}

export function createAllTools(cwd: string, websearch?: WebSearchOptions, todoStore?: TodoStore) {
  const tools: WillowTool<any>[] = [
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
