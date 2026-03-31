import { createBashTool } from "./bash";
import { createEditTool } from "./edit";
import { createFindTool } from "./find";
import { createGrepTool } from "./grep";
import { createLsTool } from "./ls";
import { createReadTool } from "./read";
import { createWebFetchTool } from "./webfetch";
import { createWriteTool } from "./write";

export {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWebFetchTool,
  createWriteTool,
};

export function createAllTools(cwd: string) {
  return [
    createBashTool(cwd),
    createEditTool(cwd),
    createFindTool(cwd),
    createGrepTool(cwd),
    createLsTool(cwd),
    createReadTool(cwd),
    createWebFetchTool(),
    createWriteTool(cwd),
  ];
}
