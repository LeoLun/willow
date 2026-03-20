import { Injectable } from "@willow/poetry";
import { app } from "electron";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@main/db/schema";

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
    this.sqlite = new Database(dbPath);
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
