import { readFile, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
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

import { builtinSkillSettings, sessions, workspaces } from "../src/main/db/schema";
import { DbService } from "../src/main/service/db.service";

const appPath = fileURLToPath(new URL("..", import.meta.url));

describe("DbService", () => {
  let service: DbService;
  let databasePath: string;

  beforeEach(async () => {
    electronMocks.userDataPath = await mkdtemp(join(tmpdir(), "willow-db-"));
    electronMocks.appPath = appPath;
    databasePath = join(electronMocks.userDataPath, "willow.db");
    service = new DbService();
  });

  afterEach(async () => {
    service.close();
    await rm(electronMocks.userDataPath, { recursive: true, force: true });
  });

  it("runs migrations for a new database and preserves data on repeated initialization", () => {
    const db = service.getDb();
    const workspace = db
      .insert(workspaces)
      .values({ name: "Willow", path: "/workspace/willow" })
      .returning()
      .get();

    expect(workspace.createdAt).toBeInstanceOf(Date);
    expect(workspace.pinned).toBe(false);
    service.close();

    service = new DbService();
    service.init();

    expect(service.getDb().select().from(workspaces).all()).toHaveLength(1);
  });

  it("persists built-in skill settings across database initialization", () => {
    service
      .getDb()
      .insert(builtinSkillSettings)
      .values({ skillId: "review", enabled: false })
      .run();
    service.close();

    service = new DbService();
    expect(service.getDb().select().from(builtinSkillSettings).all()).toEqual([
      { skillId: "review", enabled: false },
    ]);
  });

  it("enforces workspace and session constraints", () => {
    const db = service.getDb();
    const workspace = db
      .insert(workspaces)
      .values({ name: "Willow", path: "/workspace/willow" })
      .returning()
      .get();
    const session = db
      .insert(sessions)
      .values({ workspaceId: workspace.id, agentSessionId: "one" })
      .returning()
      .get();

    expect(session.title).toBe("");
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(() =>
      db.insert(workspaces).values({ name: "Duplicate", path: workspace.path }).run(),
    ).toThrow();
    expect(() =>
      db.insert(sessions).values({ workspaceId: 999_999, title: "Missing workspace" }).run(),
    ).toThrow();

    db.delete(workspaces).where(eq(workspaces.id, workspace.id)).run();
    expect(db.select().from(sessions).all()).toHaveLength(0);
  });

  it("keeps an unknown valid database and adds the Willow schema", () => {
    const unknown = new BetterSqlite3(databasePath);
    unknown.exec("CREATE TABLE external_data (id integer PRIMARY KEY, value text NOT NULL)");
    unknown.prepare("INSERT INTO external_data (id, value) VALUES (1, 'keep')").run();
    unknown.close();

    service.init();

    const sqlite = new BetterSqlite3(databasePath, { readonly: true });
    const externalData = sqlite.prepare("SELECT value FROM external_data WHERE id = 1").get();
    sqlite.close();
    expect(externalData).toEqual({ value: "keep" });
    expect(service.getDb().select().from(workspaces).all()).toEqual([]);
  });

  it("does not delete a corrupt database", async () => {
    const corruptContents = Buffer.from("not a sqlite database");
    await writeFile(databasePath, corruptContents);

    expect(() => service.init()).toThrow("Failed to initialize Willow database");
    expect(await readFile(databasePath)).toEqual(corruptContents);
  });
});
