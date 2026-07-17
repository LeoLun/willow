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

import { SessionDao } from "../src/main/service/dao/session.dao.server";
import { WorkspaceDao } from "../src/main/service/dao/workspace.dao.server";
import { DbService } from "../src/main/service/db.service";
import { SessionManagerFactory } from "../src/main/service/session-manager.factory";
import { SessionService } from "../src/main/service/session.service";

const appPath = fileURLToPath(new URL("..", import.meta.url));

describe("SessionService", () => {
  let dbService: DbService;
  let sessionManagerFactory: SessionManagerFactory;
  let sessionService: SessionService;
  let workspaceId: number;
  let otherWorkspaceId: number;

  beforeEach(async () => {
    electronMocks.userDataPath = await mkdtemp(join(tmpdir(), "willow-session-service-"));
    electronMocks.appPath = appPath;

    const container = new Container({ defaultScope: "Singleton" });
    container.bind(DbService).toSelf();
    container.bind(SessionDao).toSelf();
    container.bind(WorkspaceDao).toSelf();
    container.bind(SessionManagerFactory).toSelf();
    container.bind(SessionService).toSelf();

    dbService = container.get(DbService);
    sessionManagerFactory = container.get(SessionManagerFactory);
    sessionService = container.get(SessionService);
    const workspaceDao = container.get(WorkspaceDao);
    workspaceId = workspaceDao.create({ name: "Willow", path: "/workspace/willow" }).id;
    otherWorkspaceId = workspaceDao.create({ name: "Other", path: "/workspace/other" }).id;
  });

  afterEach(async () => {
    dbService.close();
    await rm(electronMocks.userDataPath, { recursive: true, force: true });
  });

  it("creates and lists application session metadata", async () => {
    const created = await sessionService.createSession(workspaceId, {
      id: "service-session",
      title: "From service",
    });

    expect(created).toMatchObject({
      id: "service-session",
      workspaceId,
      title: "From service",
    });
    expect(await sessionService.getSessionList(workspaceId)).toEqual([created]);
    expect(await sessionService.getSessionList(otherWorkspaceId)).toEqual([]);
  });

  it("updates titles only inside the requested workspace", async () => {
    await sessionService.createSession(workspaceId, { id: "rename-me" });

    await expect(
      sessionService.updateSessionTitle(otherWorkspaceId, "rename-me", "Wrong workspace"),
    ).rejects.toMatchObject({ code: "not_found" });

    const updated = await sessionService.updateSessionTitle(workspaceId, "rename-me", "Renamed");
    expect(updated.title).toBe("Renamed");
    expect((await sessionService.getSessionList(workspaceId))[0]?.title).toBe("Renamed");
  });

  it("delegates fork and deletion to the workspace session manager", async () => {
    const sourceMetadata = await sessionService.createSession(workspaceId, { id: "source" });
    const source = await sessionManagerFactory.create(workspaceId).open(sourceMetadata);
    await source.appendCustomEntry("source-entry", { persisted: true });

    const forkedMetadata = await sessionService.forkSession(workspaceId, "source", {
      id: "forked",
    });
    const forked = await sessionManagerFactory.create(workspaceId).open(forkedMetadata);
    expect(await forked.getEntries()).toEqual([
      expect.objectContaining({ type: "custom", customType: "source-entry" }),
    ]);

    await sessionService.deleteSession(workspaceId, "forked");
    await sessionService.deleteSession(workspaceId, "forked");
    await expect(
      sessionManagerFactory.create(workspaceId).open(forkedMetadata),
    ).rejects.toMatchObject({ code: "not_found" });
    expect((await sessionService.getSessionList(workspaceId)).map(({ id }) => id)).toEqual([
      "source",
    ]);
  });
});
