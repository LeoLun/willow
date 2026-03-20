import { Injectable } from "@willow/poetry";
import { eq } from "drizzle-orm";
import { DbService } from "@main/service/db.service";
import { workspaces } from "../../db/schema";

type WorkspaceInsert = typeof workspaces.$inferInsert;

@Injectable()
export class WorkspaceDao {
  constructor(private readonly dbService: DbService) {}

  findAll() {
    return this.dbService.getDb().select().from(workspaces).all();
  }

  findById(id: number) {
    return this.dbService
      .getDb()
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .get();
  }

  insert(data: Omit<WorkspaceInsert, "createdAt" | "updatedAt">) {
    return this.dbService
      .getDb()
      .insert(workspaces)
      .values(data)
      .returning()
      .get();
  }

  update(id: number, data: Partial<Omit<WorkspaceInsert, "id">>) {
    return this.dbService
      .getDb()
      .update(workspaces)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning()
      .get();
  }

  deleteById(id: number) {
    return this.dbService
      .getDb()
      .delete(workspaces)
      .where(eq(workspaces.id, id))
      .returning()
      .get();
  }
}
