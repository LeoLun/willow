import type { Tool } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { and, eq, isNull } from "drizzle-orm";
import { mcpCredentials, mcpMetadata } from "../../db/schema";
import { DbService } from "../db.service";

@Injectable()
export class McpDao {
  constructor(private readonly dbService: DbService) {}
  readCredential(key: string) {
    return this.dbService
      .getDb()
      .select()
      .from(mcpCredentials)
      .where(eq(mcpCredentials.key, key))
      .get()?.encryptedData;
  }
  writeCredential(
    key: string,
    workspaceId: number | null,
    serverName: string,
    encryptedData: Buffer,
  ) {
    this.dbService
      .getDb()
      .insert(mcpCredentials)
      .values({ key, workspaceId, serverName, encryptedData })
      .onConflictDoUpdate({ target: mcpCredentials.key, set: { encryptedData } })
      .run();
  }
  deleteCredential(key: string) {
    this.dbService.getDb().delete(mcpCredentials).where(eq(mcpCredentials.key, key)).run();
  }
  readCache(key: string) {
    return this.dbService.getDb().select().from(mcpMetadata).where(eq(mcpMetadata.key, key)).get()
      ?.tools;
  }
  writeCache(key: string, workspaceId: number | null, serverName: string, tools: Tool[]) {
    this.dbService
      .getDb()
      .insert(mcpMetadata)
      .values({ key, workspaceId, serverName, tools })
      .onConflictDoUpdate({ target: mcpMetadata.key, set: { tools } })
      .run();
  }
  deleteServer(workspaceId: number | null, serverName: string) {
    const db = this.dbService.getDb();
    db.transaction(() => {
      for (const table of [mcpCredentials, mcpMetadata])
        db.delete(table)
          .where(
            and(
              workspaceId === null ? isNull(table.workspaceId) : eq(table.workspaceId, workspaceId),
              eq(table.serverName, serverName),
            ),
          )
          .run();
    });
  }
}
