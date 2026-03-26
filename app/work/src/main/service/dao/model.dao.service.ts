import { DbService } from "@main/service/db.service";
import { Injectable } from "@willow/poetry";
import { eq } from "drizzle-orm";
import { models } from "../../db/schema";

type ModelInsert = typeof models.$inferInsert;

@Injectable()
export class ModelDao {
  constructor(private readonly dbService: DbService) {}

  findAll() {
    return this.dbService.getDb().select().from(models).all();
  }

  findById(id: number) {
    return this.dbService.getDb().select().from(models).where(eq(models.id, id)).get();
  }

  findByModelId(modelId: string) {
    return this.dbService.getDb().select().from(models).where(eq(models.modelId, modelId)).get();
  }

  findDefault() {
    return this.dbService.getDb().select().from(models).where(eq(models.isDefault, true)).get();
  }

  insert(data: Omit<ModelInsert, "id" | "createdAt" | "updatedAt">) {
    return this.dbService.getDb().insert(models).values(data).returning().get();
  }

  update(id: number, data: Partial<Omit<ModelInsert, "id">>) {
    return this.dbService
      .getDb()
      .update(models)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(models.id, id))
      .returning()
      .get();
  }

  deleteById(id: number) {
    return this.dbService.getDb().delete(models).where(eq(models.id, id)).returning().get();
  }

  clearDefault() {
    return this.dbService
      .getDb()
      .update(models)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(models.isDefault, true))
      .returning()
      .all();
  }
}
