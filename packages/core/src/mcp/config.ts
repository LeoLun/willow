import { createHash } from "node:crypto";
import type { McpServerDefinition } from "./types.js";

export function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

export function validateMcpDefinition(value: unknown): asserts value is McpServerDefinition {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Invalid MCP server definition.");
  const d = value as McpServerDefinition;
  if (Boolean(d.command) === Boolean(d.url))
    throw new Error("Specify exactly one MCP command or URL.");
  if (d.command !== undefined && (typeof d.command !== "string" || !d.command.trim()))
    throw new Error("Invalid MCP command.");
  if (d.url !== undefined) {
    const url = new URL(d.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash)
      throw new Error("Invalid MCP HTTP URL.");
  }
  if (
    d.args !== undefined &&
    (!Array.isArray(d.args) || !d.args.every((x) => typeof x === "string"))
  )
    throw new Error("Invalid MCP arguments.");
  if (d.cwd !== undefined && typeof d.cwd !== "string")
    throw new Error("Invalid MCP working directory.");
  for (const field of [d.env, d.headers])
    if (field !== undefined && !isStringRecord(field))
      throw new Error("Invalid MCP environment or headers.");
  if (d.disabled !== undefined && typeof d.disabled !== "boolean")
    throw new Error("Invalid MCP disabled flag.");
  if (d.type !== undefined && !["stdio", "http", "sse"].includes(d.type))
    throw new Error("Invalid MCP transport type.");
  if ((d.command && d.type && d.type !== "stdio") || (d.url && d.type === "stdio"))
    throw new Error("MCP transport type does not match its options.");
  if (d.command && (d.headers || d.oauth)) throw new Error("HTTP authentication requires a URL.");
  if (d.url && (d.env || d.args || d.cwd)) throw new Error("Process options require a command.");
  if (
    d.oauth !== undefined &&
    (typeof d.oauth !== "object" ||
      d.oauth === null ||
      Array.isArray(d.oauth) ||
      Object.values(d.oauth).some((x) => x !== undefined && typeof x !== "string"))
  )
    throw new Error("Invalid MCP OAuth settings.");
  if (
    d.requestTimeoutMs !== undefined &&
    (!Number.isInteger(d.requestTimeoutMs) ||
      d.requestTimeoutMs <= 0 ||
      d.requestTimeoutMs > 600000)
  )
    throw new Error("Invalid MCP request timeout.");
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    );
  return value;
}

export function mcpFingerprint(definition: McpServerDefinition): string {
  return createHash("sha256")
    .update(JSON.stringify(stable(definition)))
    .digest("hex");
}

export function validateMcpName(name: unknown): asserts name is string {
  if (
    typeof name !== "string" ||
    !/^[\w.-]{1,100}$/.test(name) ||
    ["__proto__", "constructor", "prototype"].includes(name)
  )
    throw new Error("Invalid MCP server name.");
}
