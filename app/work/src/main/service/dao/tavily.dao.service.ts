import { DbService } from "@main/service/db.service";
import { Injectable } from "@willow/poetry";
import { eq } from "drizzle-orm";
import { tavilyApiKeys } from "../../db/schema";

type TavilyKeyInsert = typeof tavilyApiKeys.$inferInsert;

@Injectable()
export class TavilyDao {
  constructor(private readonly dbService: DbService) {}

  findAll() {
    return this.dbService.getDb().select().from(tavilyApiKeys).all();
  }

  findById(id: number) {
    return this.dbService
      .getDb()
      .select()
      .from(tavilyApiKeys)
      .where(eq(tavilyApiKeys.id, id))
      .get();
  }

  insert(data: Omit<TavilyKeyInsert, "id" | "createdAt" | "updatedAt">) {
    return this.dbService.getDb().insert(tavilyApiKeys).values(data).returning().get();
  }

  update(id: number, data: Partial<Omit<TavilyKeyInsert, "id">>) {
    return this.dbService
      .getDb()
      .update(tavilyApiKeys)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tavilyApiKeys.id, id))
      .returning()
      .get();
  }

  deleteById(id: number) {
    return this.dbService
      .getDb()
      .delete(tavilyApiKeys)
      .where(eq(tavilyApiKeys.id, id))
      .returning()
      .get();
  }
}
