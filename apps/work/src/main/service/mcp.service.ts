import { createHash } from "node:crypto";
import { lstat, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GetMcpResponse, ManageMcpRequest, ManageMcpResponse } from "@shared/api";
import { MCP_AUTH_REQUIRED_EVENT, MCP_STATUS_EVENT } from "@shared/constants";
import {
  McpManager,
  CombinedMcpRuntime,
  mcpFingerprint,
  validateMcpDefinition,
  type McpServerDefinition,
} from "@willow/core";
import { Injectable } from "@willow/poetry";
import { watch, type FSWatcher } from "chokidar";
import { app, shell } from "electron";
import { CREDENTIAL_KEY_FILE_NAME, LocalCredentialCipher } from "../utils/credential-cipher";
import { SqliteMcpCredentialStore } from "../utils/mcp-credential-store";
import { McpDao } from "./dao/mcp.dao.server";
import { WorkspaceDao } from "./dao/workspace.dao.server";
import { EventService } from "./event.service";

type Config = Record<string, unknown> & { mcpServers: Record<string, McpServerDefinition> };
type Project = {
  manager: McpManager;
  store: SqliteMcpCredentialStore;
  namespace: string;
  path: string;
  content: string;
  config: Config;
  configRevision: string;
  configError?: string;
  watcher: FSWatcher;
  unsubscribe: () => void;
};
const target = (id: number) =>
  id === 0 ? { scope: "global" as const } : { scope: "project" as const, workspaceId: id };
const REDACTED = "[saved-secret]";
const reference = (name: string) => `\${willow:${name}}`;
const isReference = (value: string) => /^\$\{(?:willow:[\w.-]+|\w+)\}$/.test(value);
const digest = (content: string) => createHash("sha256").update(content).digest("hex");

@Injectable()
export class McpService {
  private readonly authPrompts = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void }
  >();
  private readonly combined = new Map<number, CombinedMcpRuntime>();
  private readonly projects = new Map<number, Project>();
  private readonly queues = new Map<number, Promise<unknown>>();
  private readonly loads = new Map<number, Promise<Project>>();
  constructor(
    private readonly workspaceDao: WorkspaceDao,
    private readonly dao: McpDao,
    private readonly eventService: EventService,
  ) {}
  private enqueue<T>(id: number, fn: () => Promise<T>): Promise<T> {
    const result = (this.queues.get(id) ?? Promise.resolve()).catch(() => undefined).then(fn);
    this.queues.set(id, result);
    void result
      .finally(() => {
        if (this.queues.get(id) === result) this.queues.delete(id);
      })
      .catch(() => undefined);
    return result;
  }
  private async requestAuthentication(id: number, name: string, signal: AbortSignal) {
    signal.throwIfAborted();
    const key = `${id}:${name}`;
    let abort!: () => void;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        this.authPrompts.set(key, { resolve, reject });
        abort = () => {
          this.eventService.sendEvent(MCP_AUTH_REQUIRED_EVENT, {
            ...(id === 0 ? target(id) : { workspaceId: id }),
            serverName: name,
            cancelled: true,
          });
          reject(new Error("MCP login cancelled."));
        };
        signal.addEventListener("abort", abort, { once: true });
        timer = setTimeout(abort, 300000);
        this.eventService.sendEvent(MCP_AUTH_REQUIRED_EVENT, {
          ...(id === 0 ? target(id) : { workspaceId: id }),
          serverName: name,
        });
      });
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      this.authPrompts.delete(key);
    }
  }
  private async content(path: string) {
    try {
      if ((await lstat(path)).isSymbolicLink())
        throw new Error("MCP config symlinks are not supported.");
      const text = await readFile(path, "utf8");
      if (Buffer.byteLength(text) > 1024 * 1024) throw new Error("MCP configuration exceeds 1MB.");
      return text;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
      throw error;
    }
  }
  private async load(id: number): Promise<Project> {
    if (id !== 0 && !this.workspaceDao.findById(id)) throw new Error("Workspace not found.");
    if (this.projects.has(id)) return this.projects.get(id)!;
    if (this.loads.has(id)) return this.loads.get(id)!;
    const promise = this.createProject(id);
    this.loads.set(id, promise);
    try {
      return await promise;
    } finally {
      this.loads.delete(id);
    }
  }
  private async createProject(id: number) {
    const canonical = await realpath(
      id === 0 ? app.getPath("userData") : this.workspaceDao.findById(id)!.path,
    );
    const namespace = id === 0 ? `global-${digest(canonical)}` : `${id}-${digest(canonical)}`;
    const path = join(canonical, id === 0 ? "mcp.json" : ".mcp.json");
    const store = new SqliteMcpCredentialStore(
      this.dao,
      new LocalCredentialCipher(join(app.getPath("userData"), CREDENTIAL_KEY_FILE_NAME)),
      id === 0 ? null : id,
    );
    const manager = new McpManager({
      cwd: canonical,
      namespace,
      credentials: store,
      openBrowser: (url) => shell.openExternal(url),
      onAuthRequired: (name, signal) => this.requestAuthentication(id, name, signal),
      cache: {
        read: async (key) => this.dao.readCache(key),
        write: async (key, tools) =>
          this.dao.writeCache(key, id === 0 ? null : id, key.split(":").at(-2)!, tools),
      },
    });
    const watcher = watch(path, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    });
    const project: Project = {
      manager,
      store,
      namespace,
      path,
      content: "",
      config: { mcpServers: {} },
      configRevision: digest(""),
      watcher,
      unsubscribe: () => undefined,
    };
    this.projects.set(id, project);
    project.unsubscribe = manager.subscribe(() => {
      this.eventService.sendEvent(MCP_STATUS_EVENT, {
        ...target(id),
        ...this.snapshot(id, project),
      });
      if (id === 0) {
        for (const [workspaceId, workspace] of this.projects) {
          if (workspaceId !== 0)
            this.eventService.sendEvent(MCP_STATUS_EVENT, {
              ...target(workspaceId),
              ...this.snapshot(workspaceId, workspace),
            });
        }
      }
    });
    const changed = () => {
      void this.enqueue(id, async () => {
        await this.reload(id, project);
        manager.notifyStatus();
      }).catch(() => undefined);
    };
    watcher
      .on("add", changed)
      .on("change", changed)
      .on("unlink", changed)
      .on("error", () => {
        project.configError = "MCP 配置监听失败，请重新打开管理面板。";
      });
    await this.reload(id, project, true);
    return project;
  }
  private async reload(id: number, project: Project, force = false) {
    let content: string;
    try {
      content = await this.content(project.path);
    } catch {
      content = "";
      project.configError = "无法读取 MCP 配置，或配置路径是符号链接。";
      await this.clear(project);
      return;
    }
    if (!force && content === project.content) return;
    project.content = content;
    project.configRevision = digest(content);
    project.configError = undefined;
    let config: Config;
    try {
      const parsed = content ? JSON.parse(content) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      if (
        parsed.mcpServers !== undefined &&
        (!parsed.mcpServers ||
          typeof parsed.mcpServers !== "object" ||
          Array.isArray(parsed.mcpServers))
      )
        throw new Error();
      config = { ...parsed, mcpServers: parsed.mcpServers ?? {} };
    } catch {
      project.configError = "MCP 配置不是有效的 JSON 或 mcpServers 格式。";
      await this.clear(project);
      return;
    }
    project.config = config;
    const valid = new Map<string, McpServerDefinition>();
    for (const [name, definition] of Object.entries(config.mcpServers)) {
      try {
        validateMcpDefinition(definition);
        valid.set(name, definition);
      } catch {
        project.configError = "部分 MCP 服务配置无效，请修正 .mcp.json。";
      }
    }
    for (const status of project.manager.snapshot().servers)
      if (!valid.has(status.name)) await project.manager.unregister(status.name);
    for (const [name, definition] of valid) {
      const fingerprint = mcpFingerprint(definition);
      const previous = project.manager.snapshot().servers.find((s) => s.name === name);
      if (previous?.fingerprint === fingerprint) continue;
      try {
        await project.manager.replace(name, definition);
      } catch {
        project.configError = "部分 MCP 服务名称或配置无效。";
      }
    }
  }
  private async clear(project: Project) {
    project.config = { mcpServers: {} };
    await Promise.all(
      project.manager.snapshot().servers.map((s) => project.manager.unregister(s.name)),
    );
  }
  private runtime(id: number, project: Project) {
    if (id === 0) return project.manager;
    let runtime = this.combined.get(id);
    if (!runtime) {
      runtime = new CombinedMcpRuntime(
        this.projects.get(0)!.manager,
        project.manager,
        () => new Set(Object.keys(project.config.mcpServers)),
      );
      this.combined.set(id, runtime);
    }
    return runtime;
  }
  private snapshot(id: number, project: Project) {
    const status =
      id !== 0 && this.projects.has(0)
        ? this.runtime(id, project).snapshot()
        : project.manager.snapshot();
    return {
      ...status,
      servers: status.servers.map((server) => ({
        ...server,
        source:
          id === 0 || !Object.hasOwn(project.config.mcpServers, server.name)
            ? ("global" as const)
            : ("project" as const),
      })),
    };
  }
  async getManager(id: number) {
    const global = await this.load(0);
    await this.enqueue(0, () => this.reload(0, global));
    const project = await this.load(id);
    if (id !== 0) await this.enqueue(id, () => this.reload(id, project));
    return this.runtime(id, project);
  }
  async get(id: number): Promise<GetMcpResponse> {
    await this.getManager(id);
    return this.describeProject(id, this.projects.get(id)!);
  }
  private async describeProject(id: number, project: Project): Promise<GetMcpResponse> {
    const status = this.snapshot(id, project);
    const servers = await Promise.all(
      status.servers.map(async (server) => {
        const inherited = id !== 0 && !Object.hasOwn(project.config.mcpServers, server.name);
        const owner = inherited ? this.projects.get(0)! : project;
        const raw = owner.manager.definition(server.name);
        const definition: McpServerDefinition = {
          command: raw.command,
          args: raw.args,
          cwd: raw.cwd,
          env: raw.env,
          url: raw.url,
          headers: raw.headers,
          type: raw.type,
          oauth: raw.oauth
            ? {
                clientId: raw.oauth.clientId,
                scope: raw.oauth.scope,
                clientSecret: raw.oauth.clientSecret ? REDACTED : undefined,
              }
            : undefined,
          disabled: raw.disabled,
          requestTimeoutMs: raw.requestTimeoutMs,
        };
        let hasPlaintextSecrets = Boolean(raw.oauth?.clientSecret);
        for (const values of [definition.env, definition.headers])
          for (const [name, value] of Object.entries(values ?? {}))
            if (!isReference(value)) {
              values![name] = REDACTED;
              hasPlaintextSecrets = true;
            }
        const credentials = await owner.store.read(owner.manager.key(server.name));
        return {
          ...server,
          source: id === 0 || inherited ? ("global" as const) : ("project" as const),
          definition,
          hasCredentials: Boolean(credentials?.bearerToken || credentials?.tokens),
          secretNames: Object.keys(credentials?.secrets ?? {}).sort(),
          hasPlaintextSecrets,
        };
      }),
    );
    return {
      ...target(id),
      servers,
      configRevision: project.configRevision,
      configError:
        project.configError ?? (id !== 0 ? this.projects.get(0)?.configError : undefined),
      status: { ...target(id), ...status },
    };
  }
  async manage(request: ManageMcpRequest): Promise<ManageMcpResponse> {
    const requestedId = request.scope === "global" ? 0 : request.workspaceId;
    if (request.action === "cancel-login") {
      // Never wait behind connect/save work when cancelling authorization.
      await this.load(0);
      await this.load(requestedId);
    } else await this.getManager(requestedId);
    const requestedProject = this.projects.get(requestedId)!;
    const configurationAction = ["save", "delete", "migrate-secrets"].includes(request.action);
    const inherited =
      requestedId !== 0 && !Object.hasOwn(requestedProject.config.mcpServers, request.serverName);
    if (inherited && ["delete", "migrate-secrets"].includes(request.action))
      throw new Error("请在全局 MCP 区域修改此服务。");
    const id = inherited && !configurationAction ? 0 : requestedId;
    const project = this.projects.get(id)!;
    const response = () => this.describeProject(requestedId, requestedProject);
    // Login is intentionally outside the mutation queue, so cancellation remains responsive.
    if (request.action === "login") {
      await this.enqueue(id, () => this.reload(id, project));
      const prompt = this.authPrompts.get(`${id}:${request.serverName}`);
      if (prompt) {
        prompt.resolve();
        const result = await project.manager.search({ query: "", serverName: request.serverName });
        if (result.warnings.length) throw new Error(result.warnings[0]);
      } else await project.manager.login(request.serverName);
      return { project: await response() };
    }
    if (request.action === "cancel-login") {
      this.authPrompts
        .get(`${id}:${request.serverName}`)
        ?.reject(new Error("MCP login cancelled."));
      project.manager.cancelLogin(request.serverName);
      return { project: await response() };
    }
    if (request.action === "tools") {
      await project.manager.search({ query: "", serverName: request.serverName });
      const tools = this.dao.readCache(project.manager.key(request.serverName)) ?? [];
      return {
        project: await response(),
        tools: await Promise.all(
          tools.map((tool) => project.manager.describe(request.serverName, tool.name)),
        ),
      };
    }
    return this.enqueue(id, async () => {
      await this.reload(id, project);
      const { serverName: name, action } = request;
      if (["save", "delete", "migrate-secrets"].includes(action)) {
        if (project.configError) throw new Error("请先修正 MCP 配置错误。");
        if (request.configRevision !== project.configRevision)
          throw new Error("MCP 配置已变化，请重新加载后保存。");
        const config = structuredClone(project.config);
        const previous = project.manager.snapshot().servers.find((s) => s.name === name);
        const previousCredential = previous
          ? await project.store.read(project.manager.key(name))
          : undefined;
        if (action === "delete") delete config.mcpServers[name];
        else {
          const definition =
            action === "migrate-secrets"
              ? structuredClone(config.mcpServers[name]!)
              : structuredClone(request.definition!);
          validateMcpDefinition(definition);
          const secrets = { ...previousCredential?.secrets, ...request.secrets };
          for (const [fieldName, values] of [
            ["env", definition.env],
            ["headers", definition.headers],
          ] as const) {
            for (const [key, value] of Object.entries(values ?? {})) {
              if (value === REDACTED && action === "save")
                values![key] = config.mcpServers[name]?.[fieldName]?.[key] ?? "";
              if (!isReference(values![key]!)) {
                const secretName = `${fieldName}.${key}`;
                secrets[secretName] = values![key]!;
                values![key] = reference(secretName);
              }
            }
          }
          const inlineClientSecret =
            definition.oauth?.clientSecret === REDACTED
              ? project.config.mcpServers[name]?.oauth?.clientSecret
              : definition.oauth?.clientSecret;
          if (definition.oauth) delete definition.oauth.clientSecret;
          config.mcpServers[name] = definition;
          const key = `${project.namespace}:${name}:${mcpFingerprint(definition)}`;
          // Changing an endpoint or OAuth client never copies authentication tokens.
          const sameAuthority =
            config.mcpServers[name].url === project.config.mcpServers[name]?.url &&
            JSON.stringify(definition.oauth) ===
              JSON.stringify(project.config.mcpServers[name]?.oauth);
          await project.store.write(key, {
            ...(sameAuthority ? previousCredential : undefined),
            secrets,
            bearerToken: sameAuthority ? previousCredential?.bearerToken : undefined,
            clientSecret:
              request.clientSecret ??
              inlineClientSecret ??
              (sameAuthority ? previousCredential?.clientSecret : undefined),
          });
        }
        const text = JSON.stringify(config, null, 2) + "\n";
        const temp = `${project.path}.${process.pid}.tmp`;
        try {
          if ((await this.content(project.path)) !== project.content)
            throw new Error("MCP 配置已被外部修改，请重新加载。");
          await writeFile(temp, text, { flag: "wx", mode: 0o600 });
          if ((await this.content(project.path)) !== project.content)
            throw new Error("MCP 配置已被外部修改，请重新加载。");
          await rename(temp, project.path);
        } finally {
          await unlink(temp).catch(() => undefined);
        }
        await this.reload(id, project, true);
        if (action === "delete") this.dao.deleteServer(id === 0 ? null : id, name);
      } else if (action === "set-token") await project.manager.setBearerToken(name, request.token!);
      else if (action === "logout") await project.manager.logout(name);
      else if (action === "connect") await project.manager.connect(name);
      else if (action === "disconnect") await project.manager.disconnect(name);
      else if (action === "reconnect") await project.manager.reconnect(name);
      return { project: await response() };
    });
  }
  async deleteProject(id: number) {
    const project = this.projects.get(id);
    if (!project) return;
    this.combined.get(id)?.dispose();
    this.combined.delete(id);
    this.projects.delete(id);
    project.unsubscribe();
    await project.watcher.close();
    await project.manager.dispose();
  }
  async shutdown() {
    await Promise.all(
      [...this.projects.keys()].filter((id) => id !== 0).map((id) => this.deleteProject(id)),
    );
    await this.deleteProject(0);
  }
}
