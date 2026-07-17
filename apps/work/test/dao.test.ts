import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Container } from "inversify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  userDataPath: "",
  appPath: "",
}));

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => electronMocks.userDataPath),
    getAppPath: vi.fn(() => electronMocks.appPath),
  },
}));

import { CredentialDao } from "../src/main/service/dao/credential.dao.server";
import { SessionDao } from "../src/main/service/dao/session.dao.server";
import { UserConfigDao } from "../src/main/service/dao/user-config.dao.server";
import { WorkspaceDao } from "../src/main/service/dao/workspace.dao.server";
import { DbService } from "../src/main/service/db.service";

const appPath = fileURLToPath(new URL("..", import.meta.url));

describe("DAO layer", () => {
  let dbService: DbService;
  let credentialDao: CredentialDao;
  let sessionDao: SessionDao;
  let userConfigDao: UserConfigDao;
  let workspaceDao: WorkspaceDao;

  beforeEach(async () => {
    electronMocks.userDataPath = await mkdtemp(join(tmpdir(), "willow-dao-"));
    electronMocks.appPath = appPath;

    const container = new Container({ defaultScope: "Singleton" });
    container.bind(DbService).toSelf();
    container.bind(CredentialDao).toSelf();
    container.bind(WorkspaceDao).toSelf();
    container.bind(SessionDao).toSelf();
    container.bind(UserConfigDao).toSelf();

    dbService = container.get(DbService);
    credentialDao = container.get(CredentialDao);
    workspaceDao = container.get(WorkspaceDao);
    sessionDao = container.get(SessionDao);
    userConfigDao = container.get(UserConfigDao);
  });

  afterEach(async () => {
    vi.useRealTimers();
    dbService.close();
    await rm(electronMocks.userDataPath, { recursive: true, force: true });
  });

  it("resolves injectable DAOs with a shared DbService", () => {
    const workspace = workspaceDao.create({ name: "Willow", path: "/workspace/willow" });
    const session = sessionDao.create({ workspaceId: workspace.id, agentSessionId: "shared" });
    const credential = credentialDao.upsert("openai", Buffer.from("encrypted"));

    expect(workspaceDao.findById(workspace.id)).toEqual(workspace);
    expect(sessionDao.findById(session.id)).toEqual(session);
    expect(credentialDao.findByProviderId("openai")).toEqual(credential);
  });

  it("provides credential lookup, upsert, and idempotent deletion", () => {
    const initialEncryptedData = Buffer.from([0, 1, 2, 255]);
    const updatedEncryptedData = Buffer.from([255, 2, 1, 0]);

    expect(credentialDao.findByProviderId("openai")).toBeUndefined();
    expect(credentialDao.upsert("openai", initialEncryptedData)).toEqual({
      providerId: "openai",
      encryptedData: initialEncryptedData,
    });
    expect(credentialDao.upsert("openai", updatedEncryptedData)).toEqual({
      providerId: "openai",
      encryptedData: updatedEncryptedData,
    });
    credentialDao.upsert("anthropic", Buffer.from("encrypted-anthropic"));
    expect(credentialDao.findProviderIds()).toHaveLength(2);
    expect(credentialDao.findProviderIds()).toEqual(
      expect.arrayContaining(["openai", "anthropic"]),
    );
    expect(credentialDao.findByProviderId("openai")?.encryptedData).toEqual(updatedEncryptedData);
    expect(credentialDao.deleteByProviderId("openai")).toBe(true);
    expect(credentialDao.deleteByProviderId("openai")).toBe(false);
  });

  it("stores one user model configuration and updates it", () => {
    expect(userConfigDao.find()).toBeUndefined();

    expect(
      userConfigDao.upsert({
        largeModelProviderId: "openai",
        largeModelId: "gpt-large",
        smallModelProviderId: null,
        smallModelId: null,
      }),
    ).toEqual({
      id: 1,
      largeModelProviderId: "openai",
      largeModelId: "gpt-large",
      smallModelProviderId: null,
      smallModelId: null,
    });

    userConfigDao.upsert({
      largeModelProviderId: "anthropic",
      largeModelId: "claude-large",
      smallModelProviderId: "openai",
      smallModelId: "gpt-small",
    });
    expect(userConfigDao.find()).toEqual({
      id: 1,
      largeModelProviderId: "anthropic",
      largeModelId: "claude-large",
      smallModelProviderId: "openai",
      smallModelId: "gpt-small",
    });
  });

  it("provides workspace CRUD and unique-path lookup", () => {
    const first = workspaceDao.create({ name: "First", path: "/workspace/first" });
    const second = workspaceDao.create({ name: "Second", path: "/workspace/second" });

    vi.useFakeTimers({ now: Date.now() + 2_000 });
    workspaceDao.update(first.id, { name: "First updated" });
    vi.useRealTimers();

    expect(workspaceDao.findAll().map(({ id }) => id)).toEqual([first.id, second.id]);
    expect(workspaceDao.findByPath(first.path)?.name).toBe("First updated");
    expect(workspaceDao.update(first.id, {})).toEqual(workspaceDao.findById(first.id));
    expect(workspaceDao.update(999_999, { name: "Missing" })).toBeUndefined();
    expect(workspaceDao.delete(second.id)).toBe(true);
    expect(workspaceDao.delete(second.id)).toBe(false);
    expect(workspaceDao.findById(second.id)).toBeUndefined();
  });

  it("provides session CRUD and workspace-scoped lookup", () => {
    const firstWorkspace = workspaceDao.create({ name: "First", path: "/workspace/first" });
    const secondWorkspace = workspaceDao.create({ name: "Second", path: "/workspace/second" });
    const first = sessionDao.create({
      workspaceId: firstWorkspace.id,
      agentSessionId: "first",
    });
    const second = sessionDao.create({
      workspaceId: firstWorkspace.id,
      title: "Second",
      agentSessionId: "second",
    });
    sessionDao.create({
      workspaceId: secondWorkspace.id,
      title: "Other workspace",
      agentSessionId: "other",
    });

    vi.useFakeTimers({ now: Date.now() + 2_000 });
    sessionDao.update(first.id, { title: "First updated" });
    vi.useRealTimers();

    expect(sessionDao.findAll()).toHaveLength(3);
    expect(sessionDao.findAll()[0]?.id).toBe(first.id);
    expect(sessionDao.findByWorkspaceId(firstWorkspace.id).map(({ id }) => id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(sessionDao.findByAgentSessionId("first")?.title).toBe("First updated");
    expect(sessionDao.update(first.id, {})).toEqual(sessionDao.findById(first.id));
    expect(sessionDao.update(999_999, { title: "Missing" })).toBeUndefined();
    expect(sessionDao.delete(second.id)).toBe(true);
    expect(sessionDao.delete(second.id)).toBe(false);
  });

  it("enforces session foreign keys and cascades workspace deletion", () => {
    const workspace = workspaceDao.create({ name: "Willow", path: "/workspace/willow" });
    sessionDao.create({ workspaceId: workspace.id, agentSessionId: "cascade" });

    expect(() =>
      sessionDao.create({ workspaceId: 999_999, agentSessionId: "missing-workspace" }),
    ).toThrow();
    expect(workspaceDao.delete(workspace.id)).toBe(true);
    expect(sessionDao.findByWorkspaceId(workspace.id)).toEqual([]);
  });
});
