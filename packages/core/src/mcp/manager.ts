import { resolve } from "node:path";
import {
  Client,
  SSEClientTransport,
  StreamableHTTPClientTransport,
  SdkHttpError,
  UnauthorizedError,
  type AuthProvider,
  type Transport,
} from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import { Ajv } from "ajv";
import addFormats from "ajv-formats";
import { McpAuthService, McpLoginError } from "./auth.js";
import { mcpFingerprint, validateMcpDefinition, validateMcpName } from "./config.js";
import { rankMcpTools } from "./search.js";
import type {
  McpCallInput,
  McpManagerOptions,
  McpSearchInput,
  McpSearchResult,
  McpServerDefinition,
  McpServerStatus,
  McpStatusSnapshot,
  Tool,
} from "./types.js";

type Entry = {
  definition: McpServerDefinition;
  fingerprint: string;
  key: string;
  tools?: Tool[];
  status: McpServerStatus["status"];
  error?: string;
  client?: Client;
  transport?: Transport;
  connecting?: Promise<Client>;
  discovering?: Promise<Client>;
  controller: AbortController;
  inFlight: number;
  lastUsed: number;
  paused: boolean;
  toolsRevision: number;
};

export class McpManager {
  readonly auth: McpAuthService;
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Set<(snapshot: McpStatusSnapshot) => void>();
  private readonly validator = new Ajv({ strict: false, allErrors: true, addUsedSchema: false });
  private revision = 0;
  private disposed = false;
  private readonly idleTimer: ReturnType<typeof setInterval>;
  constructor(private readonly options: McpManagerOptions) {
    (addFormats as unknown as (ajv: Ajv) => void)(this.validator);
    this.auth = new McpAuthService(options.credentials, options.openBrowser);
    this.idleTimer = setInterval(
      () => {
        for (const [name, entry] of this.entries)
          if (
            entry.client &&
            !entry.inFlight &&
            Date.now() - entry.lastUsed > (options.idleTimeoutMs ?? 600000)
          )
            void this.closeEntry(entry).then(() => {
              if (this.entries.get(name) === entry) this.publish();
            });
      },
      Math.min(options.idleTimeoutMs ?? 600000, 30000),
    );
    this.idleTimer.unref();
  }
  async register(name: string, definition: McpServerDefinition) {
    if (this.disposed) throw new Error("MCP runtime is disposed.");
    validateMcpName(name);
    validateMcpDefinition(definition);
    if (this.entries.has(name)) throw new Error("MCP server already registered.");
    const fingerprint = mcpFingerprint(definition);
    const key = `${this.options.namespace}:${name}:${fingerprint}`;
    const entry: Entry = {
      definition: structuredClone(definition),
      fingerprint,
      key,
      status: definition.disabled ? "disabled" : "not-connected",
      controller: new AbortController(),
      inFlight: 0,
      lastUsed: Date.now(),
      paused: false,
      toolsRevision: 0,
    };
    this.entries.set(name, entry);
    try {
      entry.tools = await this.options.cache?.read(key);
    } catch {
      /* Cache failure must not prevent registration. */
    }
    this.publish();
  }
  key(name: string) {
    return this.get(name).key;
  }
  fingerprint(name: string) {
    return this.get(name).fingerprint;
  }
  definition(name: string) {
    return structuredClone(this.get(name).definition);
  }
  async unregister(name: string) {
    const entry = this.get(name);
    this.entries.delete(name);
    this.auth.cancelLogin(entry.key);
    await this.closeEntry(entry);
    this.publish();
  }
  async replace(name: string, definition: McpServerDefinition) {
    validateMcpDefinition(definition);
    if (this.entries.has(name)) await this.unregister(name);
    await this.register(name, definition);
  }
  private get(name: string) {
    const entry = this.entries.get(name);
    if (!entry) throw new Error("Unknown MCP server.");
    return entry;
  }
  private assert(name: string, entry: Entry) {
    if (this.disposed || this.entries.get(name) !== entry || entry.controller.signal.aborted)
      throw new Error("MCP configuration or connection changed.");
    if (entry.definition.disabled) throw new Error("MCP server is disabled.");
  }
  async connect(name: string): Promise<Client> {
    const entry = this.get(name);
    this.assert(name, entry);
    entry.paused = false;
    if (entry.client) return entry.client;
    if (entry.connecting) return entry.connecting;
    entry.status = "connecting";
    entry.error = undefined;
    this.publish();
    const promise = this.open(name, entry);
    entry.connecting = promise;
    try {
      return await promise;
    } catch (error) {
      if (this.entries.get(name) === entry && !entry.controller.signal.aborted) {
        entry.status =
          error instanceof UnauthorizedError ||
          /authentication|OAuth/i.test(error instanceof Error ? error.message : "")
            ? "needs-auth"
            : "failed";
        entry.error =
          entry.status === "needs-auth"
            ? "需要登录或更新密钥。"
            : "连接失败，请检查命令、地址或网络后重试。";
        this.publish();
      }
      throw new Error(entry.error ?? "MCP connection cancelled.");
    } finally {
      if (entry.connecting === promise) entry.connecting = undefined;
    }
  }
  private async connectForTools(name: string, signal?: AbortSignal): Promise<Client> {
    signal?.throwIfAborted();
    const entry = this.get(name);
    if (!entry.discovering) {
      const discover = async () => {
        try {
          return await this.connect(name);
        } catch (error) {
          signal?.throwIfAborted();
          this.assert(name, entry);
          const headers = await this.resolveValues(entry.definition.headers, entry.key);
          const stored = await this.options.credentials.read(entry.key);
          if (
            entry.status !== "needs-auth" ||
            !entry.definition.url ||
            entry.paused ||
            stored?.bearerToken ||
            Object.keys(headers).some((key) => key.toLowerCase() === "authorization")
          )
            throw error;
          signal?.throwIfAborted();
          if (this.options.onAuthRequired) {
            const authSignal = signal
              ? AbortSignal.any([signal, entry.controller.signal])
              : entry.controller.signal;
            await this.options.onAuthRequired(name, authSignal);
            authSignal.throwIfAborted();
          }
          await this.login(name);
          signal?.throwIfAborted();
          return await this.connect(name);
        }
      };
      const cancel = () => this.auth.cancelLogin(entry.key);
      signal?.addEventListener("abort", cancel, { once: true });
      const promise = discover().finally(() => {
        signal?.removeEventListener("abort", cancel);
        if (entry.discovering === promise) entry.discovering = undefined;
      });
      entry.discovering = promise;
    }
    return waitForMcp(entry.discovering, signal);
  }
  private async resolveValues(values: Record<string, string> | undefined, key: string) {
    const secrets = (await this.options.credentials.read(key))?.secrets ?? {};
    return Object.fromEntries(
      Object.entries(values ?? {}).map(([name, value]) => {
        const match = /^\$\{willow:([\w.-]+)\}$/.exec(value);
        if (match) {
          if (secrets[match[1]!] === undefined) throw new Error("Missing MCP saved secret.");
          return [name, secrets[match[1]!]!];
        }
        return [
          name,
          value.replace(/\$\{([\w]+)\}/g, (_all, variable: string) => {
            if (process.env[variable] === undefined)
              throw new Error("Missing MCP environment variable.");
            return process.env[variable]!;
          }),
        ];
      }),
    );
  }
  private async open(name: string, entry: Entry) {
    const d = entry.definition;
    const assert = () => this.assert(name, entry);
    const timeout = d.requestTimeoutMs ?? 30000;
    let provider: AuthProvider | undefined;
    const headers = await this.resolveValues(d.headers, entry.key);
    const stored = await this.options.credentials.read(entry.key);
    const hasAuthorization = Object.keys(headers).some(
      (name) => name.toLowerCase() === "authorization",
    );
    if (d.url && !hasAuthorization) {
      provider = stored?.bearerToken
        ? {
            token: async () => {
              assert();
              return (await this.options.credentials.read(entry.key))?.bearerToken;
            },
          }
        : await this.auth.provider(entry.key, d, assert);
    }
    const boundFetch: typeof fetch = (input, init) => {
      assert();
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin !== new URL(d.url!).origin)
        throw new Error("MCP transport cannot forward credentials to another origin.");
      return fetch(input, { ...init, redirect: "error" });
    };
    const makeClient = () => new Client({ name: "Willow", version: "0.1.0" }, { capabilities: {} });
    let client = makeClient();
    let transport: Transport = d.command
      ? new StdioClientTransport({
          command: d.command,
          args: d.args,
          cwd: resolve(this.options.cwd, d.cwd ?? "."),
          env: { ...getDefaultEnvironment(), ...(await this.resolveValues(d.env, entry.key)) },
          stderr: "ignore",
        })
      : d.type === "sse"
        ? new SSEClientTransport(new URL(d.url!), {
            authProvider: provider,
            requestInit: { headers },
            fetch: boundFetch,
          })
        : new StreamableHTTPClientTransport(new URL(d.url!), {
            authProvider: provider,
            requestInit: { headers },
            fetch: boundFetch,
            onInsufficientScope: "throw",
          });
    entry.transport = transport;
    try {
      assert();
      try {
        await client.connect(transport, { timeout, signal: entry.controller.signal });
      } catch (error) {
        await client.close().catch(() => undefined);
        if (
          !d.url ||
          !(error instanceof SdkHttpError) ||
          ![404, 405, 406, 415].includes(error.status)
        )
          throw error;
        assert();
        client = makeClient();
        transport = new SSEClientTransport(new URL(d.url), {
          authProvider: provider,
          requestInit: { headers },
          fetch: boundFetch,
        });
        entry.transport = transport;
        await client.connect(transport, { timeout, signal: entry.controller.signal });
      }
      assert();
      entry.client = client;
      client.onclose = () => {
        if (entry.client === client) {
          entry.client = undefined;
          entry.transport = undefined;
          entry.status = "not-connected";
          this.publish();
        }
      };
      client.onerror = () => {
        if (entry.client === client) {
          entry.error = "MCP 连接出现错误。";
          this.publish();
        }
      };
      client.setNotificationHandler("notifications/tools/list_changed", async () => {
        await this.refreshTools(name, entry).catch(() => {
          entry.error = "工具目录刷新失败。";
          this.publish();
        });
      });
      await this.refreshTools(name, entry);
      assert();
      entry.status = "connected";
      entry.lastUsed = Date.now();
      this.publish();
      return client;
    } catch (error) {
      entry.client = undefined;
      await client.close().catch(() => undefined);
      await transport.close().catch(() => undefined);
      throw error;
    }
  }
  private async refreshTools(name: string, entry: Entry) {
    const revision = ++entry.toolsRevision;
    const tools: Tool[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const result = await entry.client!.listTools(cursor ? { cursor } : undefined, {
        timeout: entry.definition.requestTimeoutMs ?? 30000,
        signal: entry.controller.signal,
      });
      tools.push(...result.tools);
      cursor = result.nextCursor;
      if (cursor && seen.has(cursor)) throw new Error("MCP tool pagination repeated.");
      if (cursor) seen.add(cursor);
      if (tools.length > 10000) throw new Error("MCP tool catalog exceeds limit.");
    } while (cursor);
    this.assert(name, entry);
    if (revision !== entry.toolsRevision) return;
    entry.tools = tools;
    await this.options.cache?.write(entry.key, tools).catch(() => undefined);
    this.publish();
  }
  private async closeEntry(entry: Entry) {
    entry.controller.abort();
    await entry.transport?.close().catch(() => undefined);
    await entry.connecting?.catch(() => undefined);
    await entry.client?.close().catch(() => undefined);
    entry.client = undefined;
    entry.transport = undefined;
    entry.controller = new AbortController();
    entry.status = entry.definition.disabled ? "disabled" : "not-connected";
  }
  async disconnect(name: string) {
    const entry = this.get(name);
    entry.paused = true;
    this.auth.cancelLogin(entry.key);
    await this.closeEntry(entry);
    this.publish();
  }
  async reconnect(name: string) {
    await this.disconnect(name);
    await this.connect(name);
  }
  async login(name: string) {
    const entry = this.get(name);
    this.assert(name, entry);
    if (!entry.definition.url) throw new Error("OAuth requires an HTTP MCP server.");
    await this.disconnect(name);
    const controller = entry.controller;
    entry.status = "authenticating";
    this.publish();
    try {
      await this.auth.login(entry.key, entry.definition, () => {
        this.assert(name, entry);
        if (entry.controller !== controller) throw new Error("MCP connection changed.");
      });
      await this.connect(name);
    } catch (error) {
      if (this.entries.get(name) === entry) {
        entry.status = "needs-auth";
        entry.error = error instanceof McpLoginError ? error.message : "登录未完成，请重试。";
        this.publish();
      }
      throw new Error(entry.error ?? "MCP login failed or cancelled.");
    }
  }
  cancelLogin(name: string) {
    this.auth.cancelLogin(this.get(name).key);
  }
  async logout(name: string) {
    const entry = this.get(name);
    await this.disconnect(name);
    await this.auth.logout(entry.key);
    entry.status = "needs-auth";
    this.publish();
  }
  async setBearerToken(name: string, token: string) {
    const entry = this.get(name);
    if (!entry.definition.url)
      throw new Error("Bearer authentication requires an HTTP MCP server.");
    await this.disconnect(name);
    await this.auth.setBearerToken(entry.key, token);
  }
  async search(input: McpSearchInput, signal?: AbortSignal): Promise<McpSearchResult> {
    if (
      typeof input.query !== "string" ||
      input.query.length > 1000 ||
      (input.limit !== undefined &&
        (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50))
    )
      throw new Error("Invalid MCP search query or limit.");
    const candidates = input.serverName
      ? [[input.serverName, this.get(input.serverName)] as const]
      : [...this.entries];
    const warnings: string[] = [];
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, candidates.length) }, async () => {
        while (next < candidates.length) {
          signal?.throwIfAborted();
          const [name, entry] = candidates[next++]!;
          if (entry.definition.disabled) continue;
          if (!entry.tools && !entry.paused) {
            try {
              await this.connectForTools(name, signal);
            } catch {
              warnings.push(`${name}: ${entry.error ?? "工具发现失败。"}`);
            }
          }
        }
      }),
    );
    signal?.throwIfAborted();
    const ranked = rankMcpTools(
      input.query,
      candidates
        .filter(([, e]) => !e.definition.disabled)
        .map(([serverName, e]) => ({ serverName, tools: e.tools ?? [], cached: !e.client })),
    );
    return {
      results: ranked.slice(0, input.limit ?? 10),
      total: ranked.length,
      warnings: warnings.sort(),
    };
  }
  async catalog(serverName: string, signal?: AbortSignal) {
    const result = await this.search({ query: "", serverName }, signal);
    const entry = this.get(serverName);
    return {
      tools: entry.definition.disabled ? [] : structuredClone(entry.tools ?? []),
      cached: !entry.client,
      warnings: result.warnings,
    };
  }
  async describe(serverName: string, toolName: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const entry = this.get(serverName);
    this.assert(serverName, entry);
    if (!entry.tools) await this.connectForTools(serverName, signal);
    signal?.throwIfAborted();
    const tool = entry.tools?.find((t) => t.name === toolName);
    if (!tool) throw new Error("Unknown MCP tool.");
    return {
      serverName,
      toolName,
      description: tool.description ?? "",
      inputSchema: structuredClone(tool.inputSchema),
      cached: !entry.client,
      fingerprint: entry.fingerprint,
    };
  }
  async call(
    input: McpCallInput,
    fingerprint: string,
    signal?: AbortSignal,
    assertCurrent?: () => void,
  ) {
    const entry = this.get(input.serverName);
    this.assert(input.serverName, entry);
    if (fingerprint !== entry.fingerprint)
      throw new Error("MCP configuration changed after approval.");
    signal?.throwIfAborted();
    const client = await this.connectForTools(input.serverName, signal);
    const tool = entry.tools?.find((t) => t.name === input.toolName);
    if (!tool) throw new Error("Unknown MCP tool.");
    const validate = this.validator.compile(tool.inputSchema);
    if (!validate(input.arguments)) throw new Error("Invalid MCP tool arguments.");
    signal?.throwIfAborted();
    this.assert(input.serverName, entry);
    assertCurrent?.();
    entry.inFlight++;
    try {
      return await client.callTool(
        { name: input.toolName, arguments: input.arguments },
        {
          signal: signal
            ? AbortSignal.any([signal, entry.controller.signal])
            : entry.controller.signal,
          timeout: entry.definition.requestTimeoutMs ?? 30000,
        },
      );
    } finally {
      entry.inFlight--;
      entry.lastUsed = Date.now();
    }
  }
  snapshot(): McpStatusSnapshot {
    const servers = [...this.entries]
      .map(([name, e]) => ({
        name,
        status: e.status,
        transport: e.definition.command ? ("stdio" as const) : ("http" as const),
        toolCount: e.tools?.length ?? 0,
        cached: Boolean(e.tools) && !e.client,
        fingerprint: e.fingerprint,
        error: e.error,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      revision: this.revision,
      servers,
      connectedCount: servers.filter((s) => s.status === "connected").length,
      totalTools: servers.reduce((n, s) => n + s.toolCount, 0),
    };
  }
  subscribe(listener: (snapshot: McpStatusSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }
  notifyStatus() {
    this.publish();
  }
  private publish() {
    this.revision++;
    for (const listener of this.listeners) {
      try {
        listener(this.snapshot());
      } catch {
        /* A UI subscriber must not break runtime lifecycle. */
      }
    }
  }
  async dispose() {
    this.disposed = true;
    clearInterval(this.idleTimer);
    this.auth.cancelAll();
    await Promise.all([...this.entries.values()].map((entry) => this.closeEntry(entry)));
    this.entries.clear();
    this.publish();
    this.listeners.clear();
  }
}

/** Cancel one discovery waiter without cancelling another session's shared connection. */
function waitForMcp<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("MCP request cancelled."));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
