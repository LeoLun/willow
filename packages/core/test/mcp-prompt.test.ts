import { describe, expect, it } from "vitest";
import type { McpStatusSnapshot } from "../src/mcp/types.js";
import { getMcpPrompt } from "../src/prompt/mcp.js";

const snapshot: McpStatusSnapshot = {
  revision: 1,
  connectedCount: 0,
  totalTools: 0,
  servers: [
    {
      name: "codegraph",
      status: "not-connected",
      transport: "stdio",
      toolCount: 0,
      cached: false,
      fingerprint: "fingerprint",
    },
  ],
};

describe("MCP agent guidance", () => {
  it("advertises configured services and the proxy workflow without requiring discovery", () => {
    const prompt = getMcpPrompt(snapshot, "default");
    expect(prompt).toContain('"name":"codegraph"');
    for (const tool of ["mcpSearch", "mcpDescribe", "mcpCall"]) expect(prompt).toContain(tool);
    expect(prompt).toContain("Do not substitute a Bash CLI");
    expect(prompt).toContain("trusted by default");
    expect(prompt).toContain("do not ask the user to grant service trust");
    expect(prompt).not.toContain("fingerprint");
  });
  it("keeps Plan mode discovery-only", () => {
    const prompt = getMcpPrompt(snapshot, "plan");
    expect(prompt).toContain("Actual MCP calls require leaving Plan mode");
    expect(prompt).not.toContain("Execute the requested operation with mcpCall");
  });
});
