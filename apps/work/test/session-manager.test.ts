import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SessionError } from "@earendil-works/pi-agent-core";
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

import { SessionDao } from "../src/main/service/dao/session.dao.server";
import { WorkspaceDao } from "../src/main/service/dao/workspace.dao.server";
import { DbService } from "../src/main/service/db.service";
import { SessionManager } from "../src/main/utils/session-manager";

const appPath = fileURLToPath(new URL("..", import.meta.url));

describe("SessionManager", () => {
  let dbService: DbService;
  let sessionDao: SessionDao;
  let workspaceDao: WorkspaceDao;
  let manager: SessionManager;
  let otherManager: SessionManager;

  beforeEach(async () => {
    electronMocks.userDataPath = await mkdtemp(join(tmpdir(), "willow-session-manager-"));
    electronMocks.appPath = appPath;

    const container = new Container({ defaultScope: "Singleton" });
    container.bind(DbService).toSelf();
    container.bind(SessionDao).toSelf();
    container.bind(WorkspaceDao).toSelf();

    dbService = container.get(DbService);
    sessionDao = container.get(SessionDao);
    workspaceDao = container.get(WorkspaceDao);
    const workspace = workspaceDao.create({ name: "Willow", path: "/workspace/willow" });
    const otherWorkspace = workspaceDao.create({ name: "Other", path: "/workspace/other" });
    manager = new SessionManager(sessionDao, workspace.id);
    otherManager = new SessionManager(sessionDao, otherWorkspace.id);
  });

  afterEach(async () => {
    vi.useRealTimers();
    dbService.close();
    await rm(electronMocks.userDataPath, { recursive: true, force: true });
  });

  it("creates, lists, opens, and isolates sessions by workspace", async () => {
    const created = await manager.create({ id: "session-one", title: "First" });
    const metadata = await created.getMetadata();

    expect(metadata).toMatchObject({ id: "session-one", title: "First" });
    expect(metadata.createdAt).toEqual(expect.any(String));
    expect((await manager.create({})).getMetadata()).resolves.toMatchObject({
      id: expect.any(String),
    });
    expect((await manager.list()).map(({ id }) => id)).toContain("session-one");
    expect(await (await manager.open(metadata)).getMetadata()).toEqual(metadata);
    expect(await otherManager.list()).toEqual([]);
    await expect(otherManager.open(metadata)).rejects.toMatchObject({ code: "not_found" });
  });

  it("persists entries, leaf movement, labels, paths, and context across reopen", async () => {
    const session = await manager.create({ id: "durable" });
    const userId = await session.appendMessage({
      role: "user",
      content: "hello",
      timestamp: Date.now(),
    });
    const customId = await session.appendCustomEntry("audit", { ok: true });
    await session.appendLabel(userId, " greeting ");
    await session.moveTo(userId);

    const reopened = await manager.open(await session.getMetadata());
    expect(await reopened.getLeafId()).toBe(userId);
    expect(await reopened.getLabel(userId)).toBe("greeting");
    expect(await reopened.getEntry(customId)).toMatchObject({
      type: "custom",
      customType: "audit",
    });
    expect(await reopened.getStorage().findEntries("custom")).toHaveLength(1);
    expect((await reopened.getBranch()).map(({ id }) => id)).toEqual([userId]);
    expect((await reopened.buildContext()).messages).toEqual([
      expect.objectContaining({ role: "user", content: "hello" }),
    ]);
  });

  it("orders sessions by recent entry activity", async () => {
    const first = await manager.create({ id: "first" });
    await manager.create({ id: "second" });

    vi.useFakeTimers({ now: Date.now() + 2_000 });
    await first.appendCustomEntry("touch");
    vi.useRealTimers();

    expect((await manager.list()).map(({ id }) => id)).toEqual(["first", "second"]);
  });

  it("forks the complete session and selected before/at branches independently", async () => {
    const source = await manager.create({ id: "source" });
    const firstUserId = await source.appendMessage({
      role: "user",
      content: "first",
      timestamp: Date.now(),
    });
    const markerId = await source.appendCustomEntry("marker");
    const secondUserId = await source.appendMessage({
      role: "user",
      content: "second",
      timestamp: Date.now(),
    });
    const metadata = await source.getMetadata();

    const complete = await manager.fork(metadata, { id: "complete" });
    const before = await manager.fork(metadata, {
      id: "before",
      entryId: secondUserId,
      position: "before",
    });
    const at = await manager.fork(metadata, { id: "at", entryId: markerId, position: "at" });

    expect((await complete.getEntries()).map(({ id }) => id)).toEqual([
      firstUserId,
      markerId,
      secondUserId,
    ]);
    expect((await before.getEntries()).map(({ id }) => id)).toEqual([firstUserId, markerId]);
    expect((await at.getEntries()).map(({ id }) => id)).toEqual([firstUserId, markerId]);
    await complete.appendCustomEntry("fork-only");
    expect(await source.getEntries()).toHaveLength(3);
  });

  it("rejects invalid ids, leaf targets, and fork targets", async () => {
    const source = await manager.create({ id: "unique" });
    await expect(manager.create({ id: "unique" })).rejects.toMatchObject({ code: "storage" });
    await expect(source.moveTo("missing")).rejects.toMatchObject({ code: "not_found" });
    await expect(
      manager.fork(await source.getMetadata(), { id: "bad-fork", entryId: "missing" }),
    ).rejects.toEqual(expect.any(SessionError));
  });

  it("physically deletes sessions and cascades entries idempotently", async () => {
    const session = await manager.create({ id: "delete-me" });
    await session.appendCustomEntry("persisted");
    const metadata = await session.getMetadata();
    expect(sessionDao.findEntries(metadata.databaseId)).toHaveLength(1);

    await manager.delete(metadata);
    await manager.delete(metadata);

    expect(sessionDao.findById(metadata.databaseId)).toBeUndefined();
    expect(sessionDao.findEntries(metadata.databaseId)).toEqual([]);
  });
});
