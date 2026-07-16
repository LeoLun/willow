import { Injectable } from "@willow/poetry";
import { desc, eq } from "drizzle-orm";
import type { NewWorkspace, Workspace } from "../../db/schema";
import { workspaces } from "../../db/schema";
import { DbService } from "../db.service";

export type CreateWorkspaceInput = Pick<NewWorkspace, "name" | "path">;
export type UpdateWorkspaceInput = Partial<CreateWorkspaceInput>;

@Injectable()
export class WorkspaceDao {
  constructor(private readonly dbService: DbService) {}

  findAll(): Workspace[] {
    return this.dbService
      .getDb()
      .select()
      .from(workspaces)
      .orderBy(desc(workspaces.updatedAt))
      .all();
  }

  findById(id: number): Workspace | undefined {
    return this.dbService.getDb().select().from(workspaces).where(eq(workspaces.id, id)).get();
  }

  findByPath(path: string): Workspace | undefined {
    return this.dbService.getDb().select().from(workspaces).where(eq(workspaces.path, path)).get();
  }

  create(input: CreateWorkspaceInput): Workspace {
    return this.dbService.getDb().insert(workspaces).values(input).returning().get();
  }

  update(id: number, input: UpdateWorkspaceInput): Workspace | undefined {
    if (Object.keys(input).length === 0) {
      return this.findById(id);
    }

    return this.dbService
      .getDb()
      .update(workspaces)
      .set(input)
      .where(eq(workspaces.id, id))
      .returning()
      .get();
  }

  delete(id: number): boolean {
    return this.dbService.getDb().delete(workspaces).where(eq(workspaces.id, id)).run().changes > 0;
  }
}
