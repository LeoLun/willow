import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

export class SQLiteImpl {
  private db: BetterSQLite3Database;

  constructor() {
    this.db = drizzle(new Database("sqlite.db"));
  }
}
