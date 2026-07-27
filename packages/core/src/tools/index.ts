import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createBashTool } from "./bash.js";
import { createEditTool } from "./edit.js";
import { createFindTool } from "./find.js";
import { createGrepTool } from "./grep.js";
import { createLsTool } from "./ls.js";
import { createReadTool } from "./read.js";
import type { ToolRuntimeOptions } from "./types.js";
import { createWriteTool } from "./write.js";

export function createWillowTools(options: ToolRuntimeOptions): AgentTool[] {
  return [
    createBashTool(options),
    createReadTool(options),
    createWriteTool(options),
    createEditTool(options),
    createLsTool(options),
    createGrepTool(options),
    createFindTool(options),
  ];
}

export * from "./base.js";
export * from "./bash.js";
export * from "./edit.js";
export * from "./find.js";
export * from "./grep.js";
export * from "./ls.js";
export * from "./policy.js";
export * from "./read.js";
export * from "./types.js";
export * from "./write.js";
