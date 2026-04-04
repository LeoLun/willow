import { createRequire } from "node:module";
import { join } from "node:path";
import * as schema from "@main/db/schema";
import { Injectable } from "@willow/poetry";
import type Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";

const runtimeRequire = createRequire(__filename);

function loadBetterSqlite3() {
  return runtimeRequire("better-sqlite3");
}

@Injectable()
export class DbService {
  private db: BetterSQLite3Database<typeof schema> | null = null;
  private sqlite: Database.Database | null = null;

  getDb(): BetterSQLite3Database<typeof schema> {
    if (!this.db) {
      this.init();
    }
    return this.db!;
  }

  init() {
    const dbPath = join(app.getPath("userData"), "willow.db");
    const BetterSqlite3 = loadBetterSqlite3() as typeof import("better-sqlite3");
    const nativeBinding = app.isPackaged
      ? join(
          process.resourcesPath,
          "app.asar.unpacked",
          "node_modules",
          "better-sqlite3",
          "build",
          "Release",
          "better_sqlite3.node",
        )
      : undefined;

    this.sqlite = new BetterSqlite3(dbPath, nativeBinding ? { nativeBinding } : undefined);
    this.sqlite.pragma("journal_mode = WAL");
    this.sqlite.pragma("foreign_keys = ON");

    this.db = drizzle(this.sqlite, { schema });

    const migrationsFolder = app.isPackaged
      ? join(process.resourcesPath, "migrations")
      : join(app.getAppPath(), "src/main/db/migrations");

    migrate(this.db, { migrationsFolder });
  }

  close() {
    if (this.sqlite) {
      this.sqlite.close();
      this.sqlite = null;
      this.db = null;
    }
  }
}
