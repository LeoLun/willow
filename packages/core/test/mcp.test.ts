import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  McpManager,
  mcpFingerprint,
  rankMcpTools,
  validateMcpDefinition,
  createWillowTools,
  McpCallTool,
  type McpCredential,
  type McpCredentialStore,
  type Tool,
} from "../src/index.js";

const managers: McpManager[] = [];
const tools: Tool[] = [
  {
    name: "take_screenshot",
    description: "Screenshot 截图",
    inputSchema: {
      type: "object",
      properties: { format: { type: "string", description: "Image format" } },
    },
  },
  { name: "get_page", description: "Read page", inputSchema: { type: "object" } },
];
const definition = {
  command: process.execPath,
  args: [fileURLToPath(new URL("./fixtures/mcp-server.mjs", import.meta.url))],
};
function create(options: Partial<ConstructorParameters<typeof McpManager>[0]> = {}) {
  const data = new Map<string, McpCredential>();
  const credentials: McpCredentialStore = {
    read: async (k) => data.get(k),
    write: async (k, v) => {
      data.set(k, structuredClone(v));
    },
    delete: async (k) => {
      data.delete(k);
    },
  };
  const manager = new McpManager({
    cwd: process.cwd(),
    namespace: "test",
    credentials,
    openBrowser: async () => undefined,
    ...options,
  });
  managers.push(manager);
  return { manager, data };
}
afterEach(async () => {
  await Promise.all(managers.splice(0).map((m) => m.dispose()));
  vi.unstubAllEnvs();
});

describe("MCP configuration and search", () => {
  it("rejects ambiguous transports, unsafe URLs, and invalid options", () => {
    for (const d of [
      {},
      { command: "node", url: "https://test" },
      { url: "file:///etc/passwd" },
      { url: "https://test", type: "stdio" },
      { command: "node", type: "http" },
      { url: "https://test", type: "invalid" },
      { url: "https://user:pass@test" },
      { command: "node", args: [1] },
      { command: "node", requestTimeoutMs: 0 },
    ])
      expect(() => validateMcpDefinition(d)).toThrow();
    expect(() =>
      validateMcpDefinition({
        url: "https://example.com/mcp",
        oauth: { clientId: undefined },
      }),
    ).not.toThrow();
    expect(mcpFingerprint({ command: "node", env: { B: "2", A: "1" } })).toBe(
      mcpFingerprint({ env: { A: "1", B: "2" }, command: "node" }),
    );
  });
  it("ranks exact names, English and Chinese descriptions, parameters, and service names", () => {
    const entries = [{ serverName: "browser", tools, cached: true }];
    for (const query of ["take_screenshot", "SCREENSHOT", "截图", "Image format"])
      expect(rankMcpTools(query, entries)[0]?.toolName).toBe("take_screenshot");
    expect(rankMcpTools("browser", entries)).toHaveLength(2);
    expect(rankMcpTools("missing", entries)).toEqual([]);
    expect(rankMcpTools("*", entries)).toEqual(rankMcpTools("", entries));
    expect(rankMcpTools(" * ", entries)).toHaveLength(2);
  });
  it("uses configured servers without trust confirmation and still rejects disabled servers", async () => {
    const { manager } = create();
    await manager.register("browser", definition);
    await manager.register("disabled", { ...definition, disabled: true });
    expect(manager.snapshot().connectedCount).toBe(0);
    expect(manager.snapshot().servers.find((s) => s.name === "browser")?.status).toBe(
      "not-connected",
    );
    await expect(manager.connect("disabled")).rejects.toThrow("disabled");
    const result = await manager.search({ query: "screenshot" });
    expect(result.results).toMatchObject([{ serverName: "browser", toolName: "take_screenshot" }]);
    expect(result.warnings).toEqual([]);
    await expect(manager.connect("browser")).resolves.toBeDefined();
    await expect(
      manager.call(
        { serverName: "browser", toolName: "take_screenshot", arguments: { message: "hello" } },
        manager.fingerprint("browser"),
      ),
    ).resolves.toHaveProperty("content");
    expect((await manager.describe("browser", "take_screenshot")).inputSchema).toBeDefined();
    await expect(manager.register("browser", definition)).rejects.toThrow("already");
  });
  it("uses cache without starting services and reports partial discovery failure", async () => {
    const { manager } = create({
      cache: {
        read: async (key) => (key.includes(":cached:") ? tools : undefined),
        write: async () => undefined,
      },
    });
    await manager.register("cached", definition);
    await manager.register("broken", { command: "/definitely-missing-willow-mcp" });
    const result = await manager.search({ query: "screenshot", limit: 1 });
    expect(result.results[0]).toMatchObject({ serverName: "cached", cached: true });
    expect(result.warnings).toHaveLength(1);
    expect(manager.snapshot().connectedCount).toBe(0);
    await expect(manager.search({ query: "", limit: 0 })).rejects.toThrow();
  });
});

describe("MCP stdio runtime and permissions", () => {
  it("discovers real stdio tools, merges connects, validates args, and isolates inherited secrets", async () => {
    vi.stubEnv("OPENAI_API_KEY", "must-not-inherit");
    const { manager } = create();
    await manager.register("browser", { ...definition, env: { MCP_EXPLICIT: "yes" } });
    const [a, b] = await Promise.all([manager.connect("browser"), manager.connect("browser")]);
    expect(a).toBe(b);
    expect(manager.snapshot().connectedCount).toBe(1);
    expect((await manager.describe("browser", "take_screenshot")).cached).toBe(false);
    await expect(
      manager.call(
        { serverName: "browser", toolName: "take_screenshot", arguments: {} },
        manager.fingerprint("browser"),
      ),
    ).rejects.toThrow("arguments");
    const result = await manager.call(
      { serverName: "browser", toolName: "take_screenshot", arguments: { message: "env" } },
      manager.fingerprint("browser"),
    );
    expect(result.content[0]).toMatchObject({
      text: JSON.stringify({ secret: null, explicit: "yes" }),
    });
    await manager.disconnect("browser");
    expect(manager.snapshot().connectedCount).toBe(0);
    expect((await manager.search({ query: "截图" })).results[0]?.cached).toBe(true);
  });
  it("supports abort and timeout without replaying a tool", async () => {
    const { manager } = create();
    await manager.register("browser", { ...definition, requestTimeoutMs: 300 });
    await manager.connect("browser");
    const input = {
      serverName: "browser",
      toolName: "take_screenshot",
      arguments: { message: "hang" },
    };
    await expect(manager.call(input, manager.fingerprint("browser"))).rejects.toThrow();
    const controller = new AbortController();
    const call = manager.call(input, manager.fingerprint("browser"), controller.signal);
    controller.abort();
    await expect(call).rejects.toThrow();
    expect(manager.snapshot().connectedCount).toBe(1);
  });
  it.each(["request-approval", "delegate-approval", "full-access"] as const)(
    "routes MCP calls in %s mode",
    async (mode) => {
      const { manager } = create();
      await manager.register("browser", definition);
      const approval = vi.fn(
        async (_request: import("../src/index.js").ToolApprovalRequest) => "allow" as const,
      );
      const tool = new McpCallTool({
        cwd: process.cwd(),
        permissionMode: mode,
        mcp: manager,
        requestApproval: approval,
      });
      const result = await tool.execute("call-1", {
        serverName: "browser",
        toolName: "take_screenshot",
        arguments: { message: "ok" },
      });
      expect(result.content[0]).toMatchObject({ text: "ok" });
      expect(approval).toHaveBeenCalledTimes(mode === "full-access" ? 0 : 1);
      if (mode !== "full-access")
        expect(approval.mock.calls[0]?.[0]).toMatchObject({
          action: {
            type: "mcp",
            serverName: "browser",
            toolName: "take_screenshot",
            fingerprint: manager.fingerprint("browser"),
          },
          autoReviewable: true,
        });
    },
  );
  it("fails closed without approvals and when config changes during approval", async () => {
    const { manager } = create();
    await manager.register("browser", definition);
    const input = {
      serverName: "browser",
      toolName: "take_screenshot",
      arguments: { message: "ok" },
    };
    const options = {
      cwd: process.cwd(),
      permissionMode: "request-approval" as const,
      mcp: manager,
    };
    await expect(new McpCallTool(options).execute("denied", input)).rejects.toThrow("denied");
    expect(manager.snapshot().connectedCount).toBe(0);
    const changed = new McpCallTool({
      ...options,
      requestApproval: async () => {
        await manager.replace("browser", { ...definition, env: { VERSION: "2" } });
        return "allow";
      },
    });
    await expect(changed.execute("changed", input)).rejects.toThrow("changed");
    expect(manager.snapshot().connectedCount).toBe(0);
  });
  it("limits output, preserves MCP errors, and omits calls in plan mode", async () => {
    const { manager } = create();
    await manager.register("browser", definition);
    const tool = new McpCallTool({
      cwd: process.cwd(),
      permissionMode: "full-access",
      mcp: manager,
    });
    const input = {
      serverName: "browser",
      toolName: "take_screenshot",
      arguments: { message: "error" },
    };
    expect((await tool.execute("error", input)).details.isError).toBe(true);
    input.arguments.message = "x".repeat(60000);
    expect((await tool.execute("large", input)).details.truncated).toBe(true);
    expect(
      createWillowTools({
        cwd: process.cwd(),
        permissionMode: "full-access",
        mcp: manager,
        agentMode: "plan",
      }).map((t) => t.name),
    ).toContain("mcpSearch");
    expect(
      createWillowTools({
        cwd: process.cwd(),
        permissionMode: "full-access",
        mcp: manager,
        agentMode: "plan",
      }).map((t) => t.name),
    ).not.toContain("mcpCall");
  });
});
