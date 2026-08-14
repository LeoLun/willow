import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { AGENT_DIR } from "../constant.js";

export function resolveAgentDirectory(agentDir = AGENT_DIR): string {
  return isAbsolute(agentDir) ? resolve(agentDir) : resolve(homedir(), agentDir);
}

export function resolvePlanDirectory(agentDir?: string): string {
  return join(resolveAgentDirectory(agentDir), "plan");
}
