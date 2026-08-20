import { join } from "node:path";
import { Injectable } from "@willow/poetry";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import * as schema from "../db/schema";
import { getEffectiveAppPath } from "../update/hot-update-launcher";

const DATABASE_FILE_NAME = "willow.db";

type WillowDatabase = BetterSQLite3Database<typeof schema>;

@Injectable()
export class DbService {
  private db: WillowDatabase | null = null;
  private sqlite: BetterSqlite3.Database | null = null;

  getDb(): WillowDatabase {
    if (!this.db) {
      this.init();
    }
    return this.db!;
  }

  init(): void {
    if (this.db && this.sqlite) {
      return;
    }

    const sqlite = this.openDatabase(this.getDatabasePath());
    try {
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("synchronous = NORMAL");
      sqlite.pragma("foreign_keys = ON");
      sqlite.pragma("busy_timeout = 5000");

      const db = drizzle(sqlite, { schema });
      migrate(db, { migrationsFolder: this.getMigrationsFolder() });

      this.sqlite = sqlite;
      this.db = db;
    } catch (error) {
      sqlite.close();
      throw new Error("Failed to initialize Willow database", { cause: error });
    }
  }

  close(): void {
    this.sqlite?.close();
    this.sqlite = null;
    this.db = null;
  }

  getDatabasePath(): string {
    return join(app.getPath("userData"), DATABASE_FILE_NAME);
  }

  prepareForUpdate(): void {
    this.sqlite?.pragma("wal_checkpoint(TRUNCATE)");
    this.close();
  }

  private getMigrationsFolder(): string {
    return join(getEffectiveAppPath(), "src/main/db/migrations");
  }

  private openDatabase(databasePath: string): BetterSqlite3.Database {
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

    return new BetterSqlite3(databasePath, nativeBinding ? { nativeBinding } : undefined);
  }
}
