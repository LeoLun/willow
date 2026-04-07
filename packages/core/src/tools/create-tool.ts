import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { Static, TSchema } from "@sinclair/typebox";

export type ToolPermissionRisk = "medium" | "high";

export type ToolPermissionDecision =
  | { mode: "allow" }
  | { mode: "ask"; reason: string; risk: ToolPermissionRisk };

export type ToolPermissionResolver<TParams> = (params: TParams) => ToolPermissionDecision;

export interface WillowToolMeta<TParams> {
  label: string;
  permission?: ToolPermissionResolver<TParams>;
}

export type WillowTool<TSchemaType extends TSchema> = AgentTool<TSchemaType> & {
  meta: WillowToolMeta<Static<TSchemaType>>;
};

export function createTool<TSchemaType extends TSchema>(
  config: AgentTool<TSchemaType> & {
    meta: WillowToolMeta<Static<TSchemaType>>;
  },
): WillowTool<TSchemaType> {
  return {
    ...config,
    meta: config.meta,
  };
}
