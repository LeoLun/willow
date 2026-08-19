import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getAppPath: vi.fn(() => "/app"),
    getVersion: vi.fn(() => "1.0.0"),
    isPackaged: true,
  },
}));

import { selectHotUpdatePayload } from "../src/main/update/hot-update-launcher";
import {
  cleanUnusedUpdateDirectories,
  readUpdateStore,
  restoreDatabaseBackup,
  writeUpdateStore,
} from "../src/main/update/update-store";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("hot update store", () => {
  it("round trips update state atomically", async () => {
    const directory = await mkdtemp(join(tmpdir(), "willow-update-"));
    temporaryDirectories.push(directory);
    const state = { active: { version: "1.0.1", asarPath: "/updates/app.asar" } };
    writeUpdateStore(directory, state);
    expect(readUpdateStore(directory)).toEqual(state);
  });

  it("restores a database backup and removes WAL files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "willow-update-"));
    temporaryDirectories.push(directory);
    const backup = join(directory, "backup.db");
    await writeFile(backup, "new database");
    await writeFile(join(directory, "willow.db"), "broken database");
    await writeFile(join(directory, "willow.db-wal"), "wal");
    restoreDatabaseBackup(directory, backup);
    expect(await readFile(join(directory, "willow.db"), "utf8")).toBe("new database");
    expect(readUpdateStore(directory)).toEqual({});
  });

  it("tries a pending ASAR once and rolls back it with the database on the next launch", async () => {
    const directory = await mkdtemp(join(tmpdir(), "willow-update-"));
    temporaryDirectories.push(directory);
    const activeAsar = join(directory, "active.asar");
    const pendingAsar = join(directory, "pending.asar");
    const backup = join(directory, "backup.db");
    await Promise.all([
      writeFile(activeAsar, "active"),
      writeFile(pendingAsar, "pending"),
      writeFile(backup, "database before update"),
      writeFile(join(directory, "willow.db"), "migrated database"),
    ]);
    writeUpdateStore(directory, {
      active: { version: "1.0.1", asarPath: activeAsar },
      pending: { version: "1.0.2", asarPath: pendingAsar, launchAttempted: false },
      databaseBackupPath: backup,
    });

    expect(selectHotUpdatePayload(directory)?.version).toBe("1.0.2");
    expect(readUpdateStore(directory).pending?.launchAttempted).toBe(true);
    expect(selectHotUpdatePayload(directory)?.version).toBe("1.0.1");
    expect(await readFile(join(directory, "willow.db"), "utf8")).toBe("database before update");
    expect(readUpdateStore(directory)).toEqual({
      active: { version: "1.0.1", asarPath: activeAsar },
    });
  });

  it("ignores cached updates that are not newer than the packaged app", async () => {
    const directory = await mkdtemp(join(tmpdir(), "willow-update-"));
    temporaryDirectories.push(directory);
    const activeAsar = join(directory, "active.asar");
    const stagedAsar = join(directory, "staged.asar");
    await Promise.all([writeFile(activeAsar, "active"), writeFile(stagedAsar, "staged")]);
    writeUpdateStore(directory, {
      active: { version: "1.0.2", asarPath: activeAsar },
      staged: { version: "1.0.3", asarPath: stagedAsar },
    });

    expect(selectHotUpdatePayload(directory, "1.0.3")).toBeUndefined();
    expect(readUpdateStore(directory)).toEqual({});
  });

  it("keeps selecting a cached update that is newer than the packaged app", async () => {
    const directory = await mkdtemp(join(tmpdir(), "willow-update-"));
    temporaryDirectories.push(directory);
    const activeAsar = join(directory, "active.asar");
    await writeFile(activeAsar, "active");
    writeUpdateStore(directory, {
      active: { version: "1.0.4", asarPath: activeAsar },
    });

    expect(selectHotUpdatePayload(directory, "1.0.3")?.version).toBe("1.0.4");
  });

  it("restores the database before discarding an attempted update older than the package", async () => {
    const directory = await mkdtemp(join(tmpdir(), "willow-update-"));
    temporaryDirectories.push(directory);
    const pendingAsar = join(directory, "pending.asar");
    const backup = join(directory, "backup.db");
    await Promise.all([
      writeFile(pendingAsar, "pending"),
      writeFile(backup, "database before update"),
      writeFile(join(directory, "willow.db"), "migrated database"),
    ]);
    writeUpdateStore(directory, {
      pending: { version: "1.0.2", asarPath: pendingAsar, launchAttempted: true },
      databaseBackupPath: backup,
    });

    expect(selectHotUpdatePayload(directory, "1.0.3")).toBeUndefined();
    expect(await readFile(join(directory, "willow.db"), "utf8")).toBe("database before update");
    expect(readUpdateStore(directory)).toEqual({});
  });

  it("automatically promotes staged update to pending on next launch with database backup", async () => {
    const directory = await mkdtemp(join(tmpdir(), "willow-update-"));
    temporaryDirectories.push(directory);
    const activeAsar = join(directory, "active.asar");
    const stagedAsar = join(directory, "staged.asar");
    await Promise.all([
      writeFile(activeAsar, "active"),
      writeFile(stagedAsar, "staged"),
      writeFile(join(directory, "willow.db"), "initial database"),
    ]);
    writeUpdateStore(directory, {
      active: { version: "1.0.1", asarPath: activeAsar },
      staged: { version: "1.0.2", asarPath: stagedAsar },
    });

    const selected = selectHotUpdatePayload(directory);
    expect(selected?.version).toBe("1.0.2");
    const store = readUpdateStore(directory);
    expect(store.pending).toEqual({
      version: "1.0.2",
      asarPath: stagedAsar,
      launchAttempted: true,
    });
    expect(store.staged).toBeUndefined();
    expect(store.databaseBackupPath).toBeDefined();
    expect(await readFile(store.databaseBackupPath!, "utf8")).toBe("initial database");

    // Second launch without confirm will roll back to active
    expect(selectHotUpdatePayload(directory)?.version).toBe("1.0.1");
    expect(await readFile(join(directory, "willow.db"), "utf8")).toBe("initial database");
    expect(readUpdateStore(directory)).toEqual({
      active: { version: "1.0.1", asarPath: activeAsar },
    });
  });

  it("cleans up unused update directories and temporary files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "willow-update-"));
    temporaryDirectories.push(directory);
    const updatesDir = join(directory, "updates");
    const v101 = join(updatesDir, "v1.0.1");
    const v102 = join(updatesDir, "v1.0.2");
    const v103 = join(updatesDir, "v1.0.3");
    const v104 = join(updatesDir, "v1.0.4");
    await Promise.all([
      mkdir(v101, { recursive: true }),
      mkdir(v102, { recursive: true }),
      mkdir(v103, { recursive: true }),
      mkdir(v104, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(v101, "app.asar"), "1.0.1"),
      writeFile(join(v102, "app.asar"), "1.0.2"),
      writeFile(join(v103, "app.asar"), "1.0.3"),
      writeFile(join(v104, "app.asar"), "1.0.4"),
      writeFile(join(v104, "app.asar.part"), "part"),
      writeFile(join(updatesDir, "temp.part"), "temp"),
    ]);

    cleanUnusedUpdateDirectories(directory, {
      active: { version: "1.0.3", asarPath: join(v103, "app.asar") },
      staged: { version: "1.0.4", asarPath: join(v104, "app.asar") },
    });

    const exists = async (path: string) => {
      try {
        await readFile(path);
        return true;
      } catch {
        return false;
      }
    };

    expect(await exists(join(v101, "app.asar"))).toBe(false);
    expect(await exists(join(v102, "app.asar"))).toBe(false);
    expect(await exists(join(v103, "app.asar"))).toBe(true);
    expect(await exists(join(v104, "app.asar"))).toBe(true);
    expect(await exists(join(v104, "app.asar.part"))).toBe(false);
    expect(await exists(join(updatesDir, "temp.part"))).toBe(false);
  });
});
