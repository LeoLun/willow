import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import * as schema from "@main/db/schema";
import { Injectable } from "@willow/poetry";
import type Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { app } from "electron";

const runtimeRequire = createRequire(__filename);

function loadBetterSqlite3() {
  return runtimeRequire("better-sqlite3");
}

function getTableColumns(sqlite: Database.Database, tableName: string) {
  return sqlite.prepare(`PRAGMA table_info('${tableName.replace(/'/g, "''")}')`).all() as Array<{
    name: string;
    notnull: number;
  }>;
}

function getMigrationsFolder() {
  return app.isPackaged
    ? join(process.resourcesPath, "migrations")
    : join(app.getAppPath(), "src/main/db/migrations");
}

interface MigrationJournalEntry {
  idx: number;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface LoadedMigration {
  when: number;
  tag: string;
  hash: string;
  sql: string[];
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
    if (this.db && this.sqlite) {
      return;
    }

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
    try {
      this.sqlite.pragma("journal_mode = WAL");
      this.sqlite.pragma("foreign_keys = ON");

      this.runPreflightRepairs(this.sqlite);

      this.db = drizzle(this.sqlite, { schema });

      this.runMigrations(this.sqlite, getMigrationsFolder());
    } catch (error) {
      this.close();
      throw error;
    }
  }

  private runPreflightRepairs(sqlite: Database.Database) {
    this.backfillLegacySessionActivity(sqlite);
    this.repairLegacyAutomationTable(sqlite);
  }

  private backfillLegacySessionActivity(sqlite: Database.Database) {
    const columns = getTableColumns(sqlite, "sessions");
    if (columns.length === 0) {
      return;
    }

    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has("last_active_at")) {
      return;
    }

    sqlite
      .prepare(`
        UPDATE sessions
        SET last_active_at = COALESCE(last_active_at, updated_at, created_at)
        WHERE last_active_at IS NULL
      `)
      .run();
  }

  private repairLegacyAutomationTable(sqlite: Database.Database) {
    const columns = getTableColumns(sqlite, "automations");
    if (columns.length === 0) {
      return;
    }

    const columnNames = new Set(columns.map((column) => column.name));
    const isLegacyAutomationTable = columnNames.has("name") && !columnNames.has("title");
    if (!isLegacyAutomationTable) {
      return;
    }

    sqlite.exec(`
      PRAGMA foreign_keys = OFF;
      DROP TABLE IF EXISTS automation_runs;
      DROP TABLE IF EXISTS automation_triggers;
      DROP TABLE IF EXISTS automations;
      PRAGMA foreign_keys = ON;
    `);
  }

  private runMigrations(sqlite: Database.Database, migrationsFolder: string) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      );
    `);

    const lastMigration = sqlite
      .prepare(`SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1`)
      .get() as { created_at: number } | undefined;

    for (const migration of this.loadMigrations(migrationsFolder)) {
      if (lastMigration && Number(lastMigration.created_at) >= migration.when) {
        continue;
      }

      this.applyMigration(sqlite, migration);
      sqlite
        .prepare(`INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)`)
        .run(migration.hash, migration.when);
    }
  }

  private loadMigrations(migrationsFolder: string): LoadedMigration[] {
    const journalPath = join(migrationsFolder, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: MigrationJournalEntry[];
    };

    return journal.entries.map((entry) => {
      const sqlPath = join(migrationsFolder, `${entry.tag}.sql`);
      const content = readFileSync(sqlPath, "utf8");
      return {
        when: entry.when,
        tag: entry.tag,
        hash: createHash("sha256").update(content).digest("hex"),
        sql: content.split("--> statement-breakpoint"),
      };
    });
  }

  private applyMigration(sqlite: Database.Database, migration: LoadedMigration) {
    if (migration.tag === "0004_slimy_starjammers") {
      this.applyAutomationBootstrapMigration(sqlite);
      return;
    }

    sqlite.exec("BEGIN");
    try {
      for (const statement of migration.sql) {
        const sql = statement.trim();
        if (!sql) {
          continue;
        }
        sqlite.exec(sql);
      }
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  private applyAutomationBootstrapMigration(sqlite: Database.Database) {
    this.backfillLegacySessionActivity(sqlite);

    sqlite.exec("PRAGMA foreign_keys = OFF");
    sqlite.exec("BEGIN");
    try {
      sqlite.exec(`
        DROP TABLE IF EXISTS automation_runs;
        DROP TABLE IF EXISTS automation_triggers;
        DROP TABLE IF EXISTS automations;
        DROP TABLE IF EXISTS __new_session_messages;
        DROP TABLE IF EXISTS __new_sessions;
        DROP TABLE IF EXISTS __new_workspaces;

        CREATE TABLE automations (
          id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          workspace_id integer NOT NULL,
          title text NOT NULL,
          prompt text NOT NULL,
          status text DEFAULT 'enabled' NOT NULL,
          trigger_type text DEFAULT 'schedule' NOT NULL,
          last_scheduled_at integer,
          last_run_at integer,
          last_completed_at integer,
          created_at integer NOT NULL,
          updated_at integer NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE no action ON DELETE cascade
        );

        CREATE TABLE automation_triggers (
          id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          automation_id integer NOT NULL,
          type text DEFAULT 'schedule' NOT NULL,
          cron_expression text NOT NULL,
          timezone text DEFAULT 'Asia/Shanghai' NOT NULL,
          is_active integer DEFAULT true NOT NULL,
          created_at integer NOT NULL,
          updated_at integer NOT NULL,
          FOREIGN KEY (automation_id) REFERENCES automations(id) ON UPDATE no action ON DELETE cascade
        );

        CREATE TABLE automation_runs (
          id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          automation_id integer NOT NULL,
          scheduled_for integer NOT NULL,
          triggered_at integer NOT NULL,
          run_kind text NOT NULL,
          status text NOT NULL,
          session_id integer,
          error_message text,
          created_at integer NOT NULL,
          updated_at integer NOT NULL,
          FOREIGN KEY (automation_id) REFERENCES automations(id) ON UPDATE no action ON DELETE cascade,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON UPDATE no action ON DELETE set null
        );

        CREATE TABLE __new_session_messages (
          id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          group_id integer NOT NULL,
          session_id integer NOT NULL,
          content text NOT NULL,
          role text NOT NULL,
          created_at integer NOT NULL,
          updated_at integer NOT NULL,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON UPDATE no action ON DELETE no action
        );

        INSERT INTO __new_session_messages ("id", "group_id", "session_id", "content", "role", "created_at", "updated_at")
        SELECT "id", "group_id", "session_id", "content", "role", "created_at", "updated_at"
        FROM session_messages;

        DROP TABLE session_messages;
        ALTER TABLE __new_session_messages RENAME TO session_messages;

        CREATE TABLE __new_sessions (
          id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          workspace_id integer NOT NULL,
          title text NOT NULL,
          created_at integer NOT NULL,
          last_active_at integer NOT NULL,
          updated_at integer NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE no action ON DELETE no action
        );

        INSERT INTO __new_sessions ("id", "workspace_id", "title", "created_at", "last_active_at", "updated_at")
        SELECT "id", "workspace_id", "title", "created_at", "last_active_at", "updated_at"
        FROM sessions;

        DROP TABLE sessions;
        ALTER TABLE __new_sessions RENAME TO sessions;

        CREATE TABLE __new_workspaces (
          id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          name text NOT NULL,
          path text NOT NULL,
          created_at integer NOT NULL,
          updated_at integer NOT NULL
        );

        INSERT INTO __new_workspaces ("id", "name", "path", "created_at", "updated_at")
        SELECT "id", "name", "path", "created_at", "updated_at"
        FROM workspaces;

        DROP TABLE workspaces;
        ALTER TABLE __new_workspaces RENAME TO workspaces;
      `);

      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    } finally {
      sqlite.exec("PRAGMA foreign_keys = ON");
    }
  }

  close() {
    if (this.sqlite) {
      this.sqlite.close();
      this.sqlite = null;
      this.db = null;
    }
  }
}
