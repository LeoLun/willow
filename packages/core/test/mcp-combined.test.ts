import { afterEach, describe, expect, it, vi } from "vitest";
import { CombinedMcpRuntime, McpManager } from "../src/mcp/index.js";

const managers: McpManager[] = [];
function manager(namespace: string) {
  const runtime = new McpManager({
    cwd: process.cwd(),
    namespace,
    credentials: { read: async () => undefined, write: async () => {}, delete: async () => {} },
    openBrowser: async () => {},
    cache: {
      read: async () =>
        Array.from({ length: 75 }, (_, index) => ({
          name: `tool_${index}`,
          description: index === 74 ? "unique target" : "tool",
          inputSchema: { type: "object" as const },
        })),
      write: async () => {},
    },
  });
  managers.push(runtime);
  return runtime;
}
afterEach(async () => {
  await Promise.all(managers.splice(0).map((runtime) => runtime.dispose()));
});

describe("combined MCP runtime", () => {
  it("shadows global names, including disabled and invalid project entries", async () => {
    const global = manager("global");
    const project = manager("project");
    for (const name of ["shared", "only-global", "invalid"])
      await global.register(name, { command: "unused" });
    await project.register("shared", { command: "unused", disabled: true });
    const names = new Set(["shared", "invalid"]);
    const runtime = new CombinedMcpRuntime(global, project, () => names);
    expect(runtime.snapshot().servers.map((server) => server.name)).toEqual([
      "only-global",
      "shared",
    ]);
    const catalog = await runtime.search({ query: "*", limit: 50 });
    expect(catalog.total).toBe(75);
    expect(catalog.results.every((tool) => tool.serverName === "only-global")).toBe(true);
    expect((await runtime.search({ query: "unique target" })).results[0]?.toolName).toBe("tool_74");
    names.delete("invalid");
    expect(runtime.snapshot().servers).toHaveLength(3);
  });

  it("routes descriptions and rejects approvals after an identical-definition source change", async () => {
    const global = manager("global");
    const project = manager("project");
    const definition = { command: "unused" };
    await global.register("shared", definition);
    const names = new Set<string>();
    const runtime = new CombinedMcpRuntime(global, project, () => names);
    const original = await runtime.describe("shared", "tool_0");
    expect(original.fingerprint).toMatch(/^global:/);
    await project.register("shared", definition);
    names.add("shared");
    const call = vi.spyOn(global, "call");
    await expect(
      runtime.call(
        { serverName: "shared", toolName: "tool_0", arguments: {} },
        original.fingerprint,
      ),
    ).rejects.toThrow("after approval");
    expect(call).not.toHaveBeenCalled();
    expect((await runtime.describe("shared", "tool_0")).fingerprint).toMatch(/^project:/);
    const current = runtime.fingerprint("shared");
    await project.unregister("shared");
    names.clear();
    await expect(
      runtime.call({ serverName: "shared", toolName: "tool_0", arguments: {} }, current),
    ).rejects.toThrow("after approval");
  });

  it("checks ownership again immediately before execution and does not dispose shared transports", async () => {
    const global = manager("global");
    const project = manager("project");
    await global.register("shared", { command: "unused" });
    const names = new Set<string>();
    const runtime = new CombinedMcpRuntime(global, project, () => names);
    const fingerprint = runtime.fingerprint("shared");
    vi.spyOn(global, "call").mockImplementation(
      async (_input, _fingerprint, _signal, assertCurrent) => {
        await project.register("shared", { command: "unused" });
        names.add("shared");
        assertCurrent?.();
        return { content: [] };
      },
    );
    await expect(
      runtime.call({ serverName: "shared", toolName: "tool_0", arguments: {} }, fingerprint),
    ).rejects.toThrow("after approval");
    runtime.dispose();
    expect(() => runtime.fingerprint("shared")).toThrow("disposed");
    expect(global.snapshot().servers).toHaveLength(1);
  });
});
