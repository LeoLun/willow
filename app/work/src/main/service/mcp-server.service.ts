import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { WorkspaceDao } from "@main/service/dao/workspace.dao.service";
import type { McpServerConfig } from "@shared/api";
import { Injectable } from "@willow/poetry";

interface McpJsonSchema {
  mcpServers?: {
    [name: string]: {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      url?: string;
      disabled?: boolean;
    };
  };
}

class StdioMcpClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    { resolve: (val: any) => void; reject: (err: any) => void }
  >();
  private buffer = "";

  constructor(
    private readonly name: string,
    private readonly command: string,
    private readonly args: string[] = [],
    private readonly env: Record<string, string> = {},
    private readonly cwd?: string,
  ) {}

  async connect(): Promise<void> {
    try {
      const mergedEnv = {
        ...process.env,
        ...this.env,
      };

      this.process = spawn(this.command, this.args, {
        env: mergedEnv,
        cwd: this.cwd || process.cwd(),
      });

      this.process.stdout?.on("data", (data) => {
        this.buffer += data.toString();
        this.parseBuffer();
      });

      this.process.stderr?.on("data", (data) => {
        console.warn(`[MCP ${this.name} stderr]`, data.toString().trim());
      });

      this.process.on("close", (code) => {
        console.log(`[MCP ${this.name}] process closed with code ${code}`);
        this.cleanup();
      });

      this.process.on("error", (err) => {
        console.error(`[MCP ${this.name}] process error:`, err);
        this.cleanup();
      });

      // Send initialize request
      await this.request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "willow", version: "1.0.0" },
      });

      // Send initialized notification
      this.sendNotification("notifications/initialized");
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  private parseBuffer() {
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (e) {
          console.error(`[MCP ${this.name}] Failed to parse line:`, line, e);
        }
      }
    }
  }

  private handleMessage(message: any) {
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message || "MCP request failed"));
        } else {
          pending.resolve(message.result);
        }
      }
    }
  }

  private request(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin) {
        return reject(new Error("MCP client not connected"));
      }

      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });

      const payload = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.process.stdin.write(JSON.stringify(payload) + "\n");
    });
  }

  private sendNotification(method: string, params: any = {}) {
    if (!this.process || !this.process.stdin) return;
    const payload = {
      jsonrpc: "2.0",
      method,
      params,
    };
    this.process.stdin.write(JSON.stringify(payload) + "\n");
  }

  async listTools(): Promise<any[]> {
    try {
      const response = await this.request("tools/list");
      return response.tools || [];
    } catch (e) {
      console.error(`[MCP ${this.name}] listTools failed:`, e);
      return [];
    }
  }

  async callTool(name: string, args: any): Promise<any> {
    return this.request("tools/call", { name, arguments: args });
  }

  cleanup() {
    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error("MCP client disconnected"));
    }
    this.pendingRequests.clear();
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

@Injectable()
export class McpServerService {
  private activeClients = new Map<string, StdioMcpClient>();

  constructor(private readonly workspaceDao: WorkspaceDao) {}

  private getGlobalConfigPath(): string {
    return join(homedir(), ".willow", "mcp.json");
  }

  private async getWorkspaceConfigPath(workspaceId: number): Promise<string | null> {
    const workspace = this.workspaceDao.findById(workspaceId);
    if (!workspace) return null;
    return join(workspace.path, ".mcp.json");
  }

  private async readConfigFile(path: string): Promise<McpServerConfig[]> {
    try {
      const raw = await readFile(path, "utf-8");
      const parsed: McpJsonSchema = JSON.parse(raw);
      const servers = parsed.mcpServers || {};
      return Object.entries(servers).map(([name, s]) => ({
        name,
        type: s.url ? ("sse" as const) : ("stdio" as const),
        command: s.command,
        args: s.args,
        env: s.env,
        url: s.url,
        disabled: s.disabled ?? false,
      }));
    } catch {
      return [];
    }
  }

  private async writeConfigFile(path: string, configs: McpServerConfig[]): Promise<void> {
    const mcpServers: Record<string, any> = {};
    for (const c of configs) {
      if (c.type === "sse") {
        mcpServers[c.name] = {
          url: c.url,
          disabled: c.disabled ?? false,
        };
      } else {
        mcpServers[c.name] = {
          command: c.command,
          args: c.args || [],
          env: c.env || {},
          disabled: c.disabled ?? false,
        };
      }
    }

    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, JSON.stringify({ mcpServers }, null, 2), "utf-8");
  }

  async getServers(workspaceId?: number): Promise<McpServerConfig[]> {
    if (workspaceId) {
      const path = await this.getWorkspaceConfigPath(workspaceId);
      return path ? this.readConfigFile(path) : [];
    } else {
      return this.readConfigFile(this.getGlobalConfigPath());
    }
  }

  async addServer(
    workspaceId: number | undefined,
    config: McpServerConfig,
  ): Promise<McpServerConfig[]> {
    const path = workspaceId
      ? await this.getWorkspaceConfigPath(workspaceId)
      : this.getGlobalConfigPath();
    if (!path) throw new Error("Config file path not resolved");

    const configs = await this.readConfigFile(path);
    const existingIndex = configs.findIndex((c) => c.name === config.name);
    if (existingIndex !== -1) {
      configs[existingIndex] = config;
    } else {
      configs.push(config);
    }

    await this.writeConfigFile(path, configs);
    return configs;
  }

  async updateServer(
    workspaceId: number | undefined,
    config: McpServerConfig,
  ): Promise<McpServerConfig[]> {
    return this.addServer(workspaceId, config);
  }

  async deleteServer(workspaceId: number | undefined, name: string): Promise<McpServerConfig[]> {
    const path = workspaceId
      ? await this.getWorkspaceConfigPath(workspaceId)
      : this.getGlobalConfigPath();
    if (!path) throw new Error("Config file path not resolved");

    let configs = await this.readConfigFile(path);
    configs = configs.filter((c) => c.name !== name);
    await this.writeConfigFile(path, configs);

    const clientKey = `${workspaceId || "global"}__${name}`;
    const client = this.activeClients.get(clientKey);
    if (client) {
      client.cleanup();
      this.activeClients.delete(clientKey);
    }

    return configs;
  }

  async toggleServer(
    workspaceId: number | undefined,
    name: string,
    disabled: boolean,
  ): Promise<McpServerConfig[]> {
    const path = workspaceId
      ? await this.getWorkspaceConfigPath(workspaceId)
      : this.getGlobalConfigPath();
    if (!path) throw new Error("Config file path not resolved");

    const configs = await this.readConfigFile(path);
    const server = configs.find((c) => c.name === name);
    if (server) {
      server.disabled = disabled;
      await this.writeConfigFile(path, configs);

      const clientKey = `${workspaceId || "global"}__${name}`;
      if (disabled) {
        const client = this.activeClients.get(clientKey);
        if (client) {
          client.cleanup();
          this.activeClients.delete(clientKey);
        }
      }
    }
    return configs;
  }

  async getActiveTools(workspaceId?: number): Promise<any[]> {
    const globalConfigs = await this.getServers();
    const workspaceConfigs = workspaceId ? await this.getServers(workspaceId) : [];

    const activeServers = [
      ...globalConfigs.map((c) => ({ ...c, workspaceId: undefined })),
      ...workspaceConfigs.map((c) => ({ ...c, workspaceId })),
    ].filter((c) => !c.disabled);

    const allTools: any[] = [];

    for (const server of activeServers) {
      if (server.type !== "stdio") {
        // SSE is not implemented in this phase
        continue;
      }

      const clientKey = `${server.workspaceId || "global"}__${server.name}`;
      let client = this.activeClients.get(clientKey);

      if (!client) {
        client = new StdioMcpClient(
          server.name,
          server.command || "",
          server.args || [],
          server.env || {},
          server.workspaceId ? this.workspaceDao.findById(server.workspaceId)?.path : undefined,
        );
        try {
          await client.connect();
          this.activeClients.set(clientKey, client);
        } catch (e) {
          console.error(`Failed to connect to MCP server: ${server.name}`, e);
          continue;
        }
      }

      const tools = await client.listTools();
      for (const t of tools) {
        // Wrap tools with namespace
        const finalName = `mcp__${server.name}__${t.name}`;
        allTools.push({
          ...t,
          originalName: t.name,
          name: finalName,
          serverName: server.name,
          clientKey,
        });
      }
    }

    return allTools;
  }

  async callActiveTool(clientKey: string, originalName: string, args: any): Promise<any> {
    const client = this.activeClients.get(clientKey);
    if (!client) throw new Error(`MCP client for ${clientKey} is not active`);
    return client.callTool(originalName, args);
  }

  shutdown() {
    for (const client of this.activeClients.values()) {
      client.cleanup();
    }
    this.activeClients.clear();
  }
}
