import type { Agent, AgentOptions } from "./types";

export { AgentCore } from "./core.js";
export type { Credential, CredentialStore } from "@earendil-works/pi-ai";

export type {
  Agent,
  AgentCoreOptions,
  AgentHarnessOptions,
  AgentOptions,
  SessionManagerOption,
} from "./types";

export function createAgent(options: AgentOptions): Agent {
  return {
    name: options.name,
    run(input) {
      return `${options.name}: ${input}`;
    },
  };
}
