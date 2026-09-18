import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpAuthService } from "@willow/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const paths = vi.hoisted(() => ({ userData: "", appPath: "" }));
vi.mock("electron", () => ({
  app: { isPackaged: false, getPath: () => paths.userData, getAppPath: () => paths.appPath },
  shell: { openExternal: vi.fn(async () => undefined) },
}));
import { GetMcpController } from "../src/main/controllers/mcp/get.mcp.controller";
import { ManageMcpController } from "../src/main/controllers/mcp/manage.mcp.controller";
import { McpDao } from "../src/main/service/dao/mcp.dao.server";
import { WorkspaceDao } from "../src/main/service/dao/workspace.dao.server";
import { DbService } from "../src/main/service/db.service";
import type { EventService } from "../src/main/service/event.service";
import { McpService } from "../src/main/service/mcp.service";
import { LocalCredentialCipher } from "../src/main/utils/credential-cipher";
import { SqliteMcpCredentialStore } from "../src/main/utils/mcp-credential-store";

let db: DbService;
let dao: McpDao;
let workspaces: WorkspaceDao;
let service: McpService;
let id: number;
let directory: string;
const events = { sendEvent: vi.fn() };
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "willow-mcp-work-"));
  paths.userData = directory;
  paths.appPath = fileURLToPath(new URL("..", import.meta.url));
  db = new DbService();
  dao = new McpDao(db);
  workspaces = new WorkspaceDao(db);
  id = workspaces.create({ name: "MCP", path: directory }).id;
  service = new McpService(workspaces, dao, events as unknown as EventService);
});
afterEach(async () => {
  await service?.shutdown();
  db?.close();
  await rm(directory, { recursive: true, force: true });
});

describe("MCP login guidance", () => {
  it.each(
    ["project", "global"].flatMap((scope) =>
      ["login", "cancel", "stop"].map((action) => ({ scope, action })),
    ),
  )(
    "$scope prompts before browser authorization and handles $action",
    async ({ scope, action }) => {
      const global = scope === "global";
      const target = global ? { scope: "global" as const } : { workspaceId: id };
      let authorized = false;
      const server = createServer(async (request, response) => {
        if (!authorized) {
          response.writeHead(401).end();
          return;
        }
        if (request.method !== "POST") {
          response.writeHead(405).end();
          return;
        }
        let body = "";
        for await (const chunk of request) body += chunk;
        const rpc = JSON.parse(body);
        if (rpc.id === undefined) {
          response.writeHead(202).end();
          return;
        }
        response.writeHead(200, { "Content-Type": "application/json" }).end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: rpc.id,
            result:
              rpc.method === "initialize"
                ? {
                    protocolVersion: "2025-03-26",
                    capabilities: { tools: {} },
                    serverInfo: { name: "test", version: "1" },
                  }
                : { tools: [] },
          }),
        );
      });
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      try {
        await writeFile(
          join(directory, global ? "mcp.json" : ".mcp.json"),
          JSON.stringify({
            mcpServers: {
              remote: {
                url: `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/mcp`,
              },
            },
          }),
        );
        const manager = await service.getManager(id);
        const login = vi.spyOn(McpAuthService.prototype, "login").mockImplementation(async () => {
          authorized = true;
        });
        const controller = new AbortController();
        const discovery = manager.search({ query: "*", serverName: "remote" }, controller.signal);
        const observed = discovery.then(
          (result) => ({ result, error: undefined }),
          (error: unknown) => ({ result: undefined, error }),
        );
        await vi.waitFor(() =>
          expect(events.sendEvent).toHaveBeenCalledWith("mcp:auth-required", {
            ...target,
            serverName: "remote",
          }),
        );
        expect(login).not.toHaveBeenCalled();
        if (action === "stop") controller.abort(new Error("Task stopped"));
        else
          await service.manage({
            ...target,
            serverName: "remote",
            action: action === "login" ? "login" : "cancel-login",
          });
        const completed = await observed;
        if (action === "login") {
          expect(login).toHaveBeenCalledTimes(1);
          expect(completed.result?.warnings).toEqual([]);
          expect(manager.snapshot().connectedCount).toBe(1);
        } else {
          expect(login).not.toHaveBeenCalled();
          if (action === "stop") expect(completed.error).toBeInstanceOf(Error);
          else expect(completed.result?.warnings.length).toBe(1);
        }
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  );
});

describe("SQLite MCP credential storage", () => {
  it("preserves existing ciphertext and caches when migrating to nullable global ownership", async () => {
    const originalAppPath = paths.appPath;
    const legacyRoot = join(directory, "legacy");
    const migrations = join(legacyRoot, "src/main/db/migrations");
    await cp(join(originalAppPath, "src/main/db/migrations"), migrations, { recursive: true });
    const journalPath = join(migrations, "meta/_journal.json");
    const journal = JSON.parse(await readFile(journalPath, "utf8"));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 10);
    await writeFile(journalPath, JSON.stringify(journal));
    paths.appPath = legacyRoot;
    paths.userData = legacyRoot;
    const legacyDb = new DbService();
    try {
      const legacyDao = new McpDao(legacyDb);
      const workspaceId = new WorkspaceDao(legacyDb).create({
        name: "legacy",
        path: legacyRoot,
      }).id;
      const cipher = new LocalCredentialCipher(join(legacyRoot, "test.key"));
      const store = new SqliteMcpCredentialStore(legacyDao, cipher, workspaceId);
      const key = "legacy:server:hash";
      await store.write(key, { bearerToken: "existing-token" });
      const ciphertext = legacyDao.readCredential(key);
      legacyDao.writeCache(key, workspaceId, "server", []);
      legacyDb.close();
      paths.appPath = originalAppPath;
      expect(legacyDao.readCredential(key)).toEqual(ciphertext);
      expect(await store.read(key)).toEqual({ bearerToken: "existing-token" });
      expect(legacyDao.readCache(key)).toEqual([]);
      new WorkspaceDao(legacyDb).delete(workspaceId);
      expect(legacyDao.readCredential(key)).toBeUndefined();
      const global = new SqliteMcpCredentialStore(legacyDao, cipher, null);
      await global.write("global:server:hash", { bearerToken: "global-token" });
      expect(await global.read("global:server:hash")).toEqual({ bearerToken: "global-token" });
    } finally {
      legacyDb.close();
      paths.appPath = originalAppPath;
      paths.userData = directory;
    }
  });
  it("migrates tables and stores only authenticated ciphertext in SQLite", async () => {
    expect(db.getDb().all("SELECT name FROM sqlite_master WHERE name = 'mcp_trust'")).toEqual([]);
    const store = new SqliteMcpCredentialStore(
      dao,
      new LocalCredentialCipher(join(directory, "test.key")),
      id,
    );
    const key = "project:server:hash";
    const value = {
      bearerToken: "secret-bearer",
      tokens: {
        access_token: "secret-access",
        refresh_token: "secret-refresh",
        token_type: "Bearer",
      },
      issuer: "https://issuer.example",
    };
    await store.write(key, value);
    expect(dao.readCredential(key)?.toString()).not.toContain("secret");
    expect(await store.read(key)).toEqual(value);
    await db.getDb().run("PRAGMA wal_checkpoint(TRUNCATE)");
    expect((await readFile(db.getDatabasePath())).includes(Buffer.from("secret-bearer"))).toBe(
      false,
    );
    await store.write(key, { bearerToken: "replacement" });
    expect(await store.read(key)).toEqual({ bearerToken: "replacement" });
    await store.delete(key);
    expect(await store.read(key)).toBeUndefined();
  });
  it("rejects ciphertext copied across projects or keys and propagates storage failure", async () => {
    const cipher = new LocalCredentialCipher(join(directory, "test.key"));
    const store = new SqliteMcpCredentialStore(dao, cipher, id);
    await store.write("p:server:1", { bearerToken: "private" });
    dao.writeCredential("p:server:2", id, "server", dao.readCredential("p:server:1")!);
    await expect(store.read("p:server:2")).rejects.toThrow("read MCP credentials");
    await expect(
      new SqliteMcpCredentialStore(dao, cipher, id + 1).read("p:server:1"),
    ).rejects.toThrow();
    vi.spyOn(dao, "writeCredential").mockImplementation(() => {
      throw new Error("secret-in-internal-error");
    });
    await expect(store.write("p:server:3", {})).rejects.toThrow("Failed to save MCP credentials.");
  });
  it("cleans credential and cache records when a workspace is deleted", async () => {
    const key = "project:server:hash";
    dao.writeCredential(key, id, "server", Buffer.from("cipher"));
    dao.writeCache(key, id, "server", []);
    workspaces.delete(id);
    expect(dao.readCredential(key)).toBeUndefined();
    expect(dao.readCache(key)).toBeUndefined();
  });
});

describe("project MCP configuration", () => {
  it("connects and calls saved stdio services without a trust action", async () => {
    const initial = await service.get(id);
    const saved = await service.manage({
      workspaceId: id,
      serverName: "local",
      action: "save",
      configRevision: initial.configRevision,
      definition: {
        command: process.execPath,
        args: [
          fileURLToPath(
            new URL("../../../packages/core/test/fixtures/mcp-server.mjs", import.meta.url),
          ),
        ],
      },
    });
    expect(saved.project.servers[0]?.status).toBe("not-connected");
    expect(
      (await service.manage({ workspaceId: id, serverName: "local", action: "connect" })).project
        .status.connectedCount,
    ).toBe(1);
    const manager = await service.getManager(id);
    const result = await manager.call(
      { serverName: "local", toolName: "take_screenshot", arguments: { message: "hello" } },
      manager.fingerprint("local"),
    );
    expect(result.content).toEqual([{ type: "text", text: "hello" }]);
  });
  it("writes shareable references to .mcp.json and secrets to SQLite", async () => {
    const initial = await service.get(id);
    const saved = await service.manage({
      workspaceId: id,
      serverName: "remote",
      action: "save",
      configRevision: initial.configRevision,
      definition: {
        url: "https://example.com/mcp",
        headers: { "X-API-Key": "private-header" },
      },
    });
    const text = await readFile(join(directory, ".mcp.json"), "utf8");
    expect(text).not.toContain("private-header");
    expect(text).toContain("${willow:headers.X-API-Key}");
    expect(saved.project.servers[0]?.status).toBe("not-connected");
    const tokenSaved = await service.manage({
      workspaceId: id,
      serverName: "remote",
      action: "set-token",
      token: "private-token",
    });
    expect(tokenSaved.project.servers[0]?.hasCredentials).toBe(true);
    expect(JSON.stringify(tokenSaved)).not.toContain("private-token");
    expect(JSON.stringify(tokenSaved)).not.toContain("private-header");
    expect(events.sendEvent).toHaveBeenCalledWith(
      "mcp:status",
      expect.objectContaining({ workspaceId: id }),
    );
  });
  it("requires fresh config revisions without requiring trust after external edits", async () => {
    const initial = await service.get(id);
    await service.manage({
      workspaceId: id,
      serverName: "remote",
      action: "save",
      configRevision: initial.configRevision,
      definition: { url: "https://example.com/mcp" },
    });
    expect((await service.get(id)).servers[0]?.status).toBe("not-connected");
    await expect(
      service.manage({
        workspaceId: id,
        serverName: "remote",
        action: "delete",
        configRevision: initial.configRevision,
      }),
    ).rejects.toThrow("变化");
    await writeFile(
      join(directory, ".mcp.json"),
      JSON.stringify({
        extra: "preserve",
        mcpServers: { remote: { url: "https://other.example/mcp" } },
      }),
    );
    const changed = await service.get(id);
    expect(changed.servers[0]?.status).toBe("not-connected");
    await service.manage({
      workspaceId: id,
      serverName: "remote",
      action: "save",
      configRevision: changed.configRevision,
      definition: { url: "https://other.example/mcp", disabled: true },
    });
    expect(JSON.parse(await readFile(join(directory, ".mcp.json"), "utf8")).extra).toBe("preserve");
  });
  it("redacts external plaintext and migrates it only after an explicit action", async () => {
    await writeFile(
      join(directory, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          remote: {
            url: "https://example.com/mcp",
            headers: { Authorization: "Bearer plaintext" },
          },
        },
      }),
    );
    const initial = await service.get(id);
    expect(JSON.stringify(initial)).not.toContain("plaintext");
    expect(initial.servers[0]?.hasPlaintextSecrets).toBe(true);
    expect(await readFile(join(directory, ".mcp.json"), "utf8")).toContain("plaintext");
    await service.manage({
      workspaceId: id,
      serverName: "remote",
      action: "migrate-secrets",
      configRevision: initial.configRevision,
    });
    expect(await readFile(join(directory, ".mcp.json"), "utf8")).not.toContain("plaintext");
  });
  it("keeps valid services visible when another entry is invalid and rejects config symlinks", async () => {
    await writeFile(
      join(directory, ".mcp.json"),
      JSON.stringify({ mcpServers: { remote: { url: "https://example.com/mcp" }, invalid: {} } }),
    );
    const initial = await service.get(id);
    expect(initial.servers).toHaveLength(1);
    expect(initial.configError).toBeTruthy();
    await writeFile(join(directory, "other.json"), "{}");
    await rm(join(directory, ".mcp.json"));
    await symlink(join(directory, "other.json"), join(directory, ".mcp.json"));
    expect((await service.get(id)).servers).toEqual([]);
  });
});

describe("MCP IPC controllers", () => {
  it("validates requests without calling services, delegates success and propagates failures", async () => {
    const mock = {
      get: vi.fn(async () => ({ workspaceId: id })),
      manage: vi.fn(async () => ({ project: { workspaceId: id } })),
    };
    const get = new GetMcpController(mock as unknown as McpService);
    const manage = new ManageMcpController(mock as unknown as McpService);
    const event = {} as Electron.IpcMainInvokeEvent;
    expect((await get.run(event, { workspaceId: 0 })).code).toBe(400);
    expect(mock.get).not.toHaveBeenCalled();
    expect((await get.run(event, { workspaceId: id })).code).toBe(0);
    expect(
      (
        await manage.run(event, {
          workspaceId: id,
          serverName: "remote",
          action: "save",
          definition: { url: "file:///private" },
        })
      ).code,
    ).toBe(400);
    expect(mock.manage).not.toHaveBeenCalled();
    const request = { workspaceId: id, serverName: "remote", action: "connect" as const };
    expect((await manage.run(event, request)).code).toBe(0);
    expect(mock.manage).toHaveBeenCalledWith(request);
    mock.manage.mockRejectedValueOnce(new Error("failed"));
    await expect(manage.run(event, request)).rejects.toThrow("failed");
  });
});

describe("global MCP configuration", () => {
  async function saveGlobal(name = "shared") {
    const initial = await service.get(0);
    return service.manage({
      scope: "global",
      serverName: name,
      action: "save",
      configRevision: initial.configRevision,
      definition: { url: "https://example.com/mcp", headers: { "X-Key": "global-secret" } },
    });
  }

  it("works without projects and encrypts global secrets separately", async () => {
    workspaces.delete(id);
    const saved = await saveGlobal();
    expect(saved.project.scope).toBe("global");
    expect(saved.project.servers[0]?.source).toBe("global");
    expect(saved.project.servers[0]?.status).toBe("not-connected");
    const text = await readFile(join(directory, "mcp.json"), "utf8");
    expect(text).toContain("${willow:headers.X-Key}");
    expect(text).not.toContain("global-secret");
    const rows = db
      .getDb()
      .all<{ workspace_id: number | null }>("SELECT workspace_id FROM mcp_credentials");
    expect(rows).toEqual([{ workspace_id: null }]);
  });

  it("shares global authentication, isolates project overrides, and restores inheritance after deletion", async () => {
    await saveGlobal();
    const secondPath = join(directory, "second");
    await mkdir(secondPath);
    const second = workspaces.create({ name: "second", path: secondPath }).id;
    await service.manage({
      scope: "global",
      serverName: "shared",
      action: "set-token",
      token: "global-token",
    });
    expect((await service.get(id)).servers[0]?.hasCredentials).toBe(true);
    expect((await service.get(second)).servers[0]?.hasCredentials).toBe(true);
    const initial = await service.get(id);
    await service.manage({
      workspaceId: id,
      serverName: "shared",
      action: "save",
      configRevision: initial.configRevision,
      definition: { url: "https://example.com/mcp", disabled: true },
    });
    const override = await service.get(id);
    expect(override.servers).toHaveLength(1);
    expect(override.servers[0]).toMatchObject({
      source: "project",
      status: "disabled",
      hasCredentials: false,
    });
    await expect(
      service.manage({ workspaceId: id, serverName: "shared", action: "connect" }),
    ).rejects.toThrow("disabled");
    await service.manage({
      workspaceId: id,
      serverName: "shared",
      action: "delete",
      configRevision: override.configRevision,
    });
    expect((await service.get(id)).servers[0]).toMatchObject({
      source: "global",
      hasCredentials: true,
    });
    await service.manage({ workspaceId: id, serverName: "shared", action: "logout" });
    expect((await service.get(second)).servers[0]?.hasCredentials).toBe(false);
    expect(JSON.stringify(await service.get(id))).not.toContain("global-token");
  });

  it("reuses one global connection and preserves it when a project is deleted", async () => {
    const initial = await service.get(0);
    await service.manage({
      scope: "global",
      serverName: "local",
      action: "save",
      configRevision: initial.configRevision,
      definition: {
        command: process.execPath,
        args: [
          fileURLToPath(
            new URL("../../../packages/core/test/fixtures/mcp-server.mjs", import.meta.url),
          ),
        ],
      },
    });
    await service.manage({ workspaceId: id, serverName: "local", action: "connect" });
    expect((await service.get(0)).status.connectedCount).toBe(1);
    const runtime = await service.getManager(id);
    const result = await runtime.call(
      { serverName: "local", toolName: "take_screenshot", arguments: { message: "shared" } },
      runtime.fingerprint("local"),
    );
    expect(result.content).toEqual([{ type: "text", text: "shared" }]);
    await service.deleteProject(id);
    workspaces.delete(id);
    expect((await service.get(0)).status.connectedCount).toBe(1);
    await expect(runtime.search({ query: "*" })).rejects.toThrow("disposed");
    const global = await service.get(0);
    await service.manage({
      scope: "global",
      serverName: "local",
      action: "delete",
      configRevision: global.configRevision,
    });
    expect((await service.get(0)).servers).toEqual([]);
  });

  it("detects concurrent/external global edits and notifies project subscribers", async () => {
    await service.get(id);
    const initial = await service.get(0);
    const results = await Promise.allSettled(
      ["one", "two"].map((serverName) =>
        service.manage({
          scope: "global",
          serverName,
          action: "save",
          configRevision: initial.configRevision,
          definition: { command: "unused" },
        }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    await writeFile(
      join(directory, "mcp.json"),
      JSON.stringify({ mcpServers: { external: { command: "unused" } } }),
    );
    await vi.waitFor(() =>
      expect(events.sendEvent).toHaveBeenCalledWith(
        "mcp:status",
        expect.objectContaining({
          workspaceId: id,
          servers: [expect.objectContaining({ name: "external", source: "global" })],
        }),
      ),
    );
    expect((await service.get(id)).servers[0]?.name).toBe("external");
  });

  it("validates explicit scopes and rejects ambiguous or missing project targets", async () => {
    const mock = { get: vi.fn(async () => ({})), manage: vi.fn(async () => ({})) };
    const get = new GetMcpController(mock as unknown as McpService);
    const event = {} as Electron.IpcMainInvokeEvent;
    expect((await get.run(event, { scope: "global" })).code).toBe(0);
    expect(mock.get).toHaveBeenCalledWith(0);
    for (const request of [
      { scope: "global", workspaceId: id },
      { scope: "project" },
      { scope: "unknown", workspaceId: id },
    ])
      expect((await get.run(event, request as never)).code).toBe(400);
    expect(mock.get).toHaveBeenCalledTimes(1);
  });
});
