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

export interface CreateAllToolsOptions {
  websearch?: WebSearchOptions;
  todoStore?: TodoStore;
  extraTools?: WillowTool<any>[];
}

export function createAllTools(cwd: string, options?: CreateAllToolsOptions): WillowTool<any>[] {
  const tools: WillowTool<any>[] = [
    createBashTool(cwd) as WillowTool<any>,
    createEditTool(cwd) as WillowTool<any>,
    createFindTool(cwd) as WillowTool<any>,
    createGrepTool(cwd) as WillowTool<any>,
    createLsTool(cwd) as WillowTool<any>,
    createReadTool(cwd) as WillowTool<any>,
    createWebFetchTool() as WillowTool<any>,
    createWriteTool(cwd) as WillowTool<any>,
  ];

  if (options?.websearch) {
    tools.push(createWebSearchTool(options.websearch.getApiKey) as WillowTool<any>);
  }

  if (options?.todoStore) {
    tools.push(createTodoWriteTool(options.todoStore) as WillowTool<any>);
    tools.push(createTodoReadTool(options.todoStore) as WillowTool<any>);
  }

  if (options?.extraTools?.length) {
    tools.push(...options.extraTools);
  }

  return tools;
}
