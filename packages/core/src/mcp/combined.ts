import { rankMcpTools } from "./search.js";
import type { McpCallInput, McpRuntime, McpSearchInput, McpStatusSnapshot, Tool } from "./types.js";

/** Owns no transports: project names (including disabled names) shadow global names. */
export class CombinedMcpRuntime implements McpRuntime {
  private disposed = false;
  dispose() {
    this.disposed = true;
  }
  constructor(
    private readonly global: McpRuntime,
    private readonly project: McpRuntime,
    private readonly projectNames: () => ReadonlySet<string>,
  ) {}

  private owner(name: string) {
    if (this.disposed) throw new Error("MCP runtime is disposed.");
    return this.projectNames().has(name)
      ? { runtime: this.project, source: "project" }
      : { runtime: this.global, source: "global" };
  }

  fingerprint(name: string) {
    const { runtime, source } = this.owner(name);
    return `${source}:${runtime.fingerprint(name)}`;
  }

  snapshot(): McpStatusSnapshot {
    if (this.disposed) throw new Error("MCP runtime is disposed.");
    const global = this.global.snapshot();
    const project = this.project.snapshot();
    const names = this.projectNames();
    const servers = [
      ...global.servers.filter((server) => !names.has(server.name)),
      ...project.servers,
    ].map((server) => ({ ...server, fingerprint: this.fingerprint(server.name) }));
    servers.sort((a, b) => a.name.localeCompare(b.name));
    return {
      revision: global.revision + project.revision,
      servers,
      connectedCount: servers.filter((server) => server.status === "connected").length,
      totalTools: servers.reduce((count, server) => count + server.toolCount, 0),
    };
  }

  async search(input: McpSearchInput, signal?: AbortSignal) {
    if (
      typeof input.query !== "string" ||
      input.query.length > 1000 ||
      (input.limit !== undefined &&
        (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50))
    )
      throw new Error("Invalid MCP search query or limit.");
    const candidates = input.serverName ? [{ name: input.serverName }] : this.snapshot().servers;
    const entries: { serverName: string; tools: Tool[]; cached: boolean }[] = [];
    const warnings: string[] = [];
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, candidates.length) }, async () => {
        while (next < candidates.length) {
          signal?.throwIfAborted();
          const name = candidates[next++]!.name;
          const { runtime } = this.owner(name);
          const found = await runtime.catalog(name, signal);
          warnings.push(...found.warnings);
          entries.push({ serverName: name, tools: found.tools, cached: found.cached });
        }
      }),
    );
    signal?.throwIfAborted();
    const results = rankMcpTools(input.query, entries);
    return {
      results: results.slice(0, input.limit ?? 10),
      total: results.length,
      warnings: warnings.sort(),
    };
  }

  async catalog(serverName: string, signal?: AbortSignal) {
    return this.owner(serverName).runtime.catalog(serverName, signal);
  }

  async describe(serverName: string, toolName: string, signal?: AbortSignal) {
    const { runtime, source } = this.owner(serverName);
    const result = await runtime.describe(serverName, toolName, signal);
    return { ...result, fingerprint: `${source}:${result.fingerprint}` };
  }

  async call(
    input: McpCallInput,
    fingerprint: string,
    signal?: AbortSignal,
    assertCurrent?: () => void,
  ) {
    if (fingerprint !== this.fingerprint(input.serverName))
      throw new Error("MCP configuration changed after approval.");
    const { runtime } = this.owner(input.serverName);
    return runtime.call(input, runtime.fingerprint(input.serverName), signal, () => {
      if (fingerprint !== this.fingerprint(input.serverName))
        throw new Error("MCP configuration changed after approval.");
      assertCurrent?.();
    });
  }
}
