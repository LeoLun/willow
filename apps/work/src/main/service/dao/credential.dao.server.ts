import { Injectable } from "@willow/poetry";
import { eq } from "drizzle-orm";
import type { StoredCredential } from "../../db/schema";
import { credentials } from "../../db/schema";
import { DbService } from "../db.service";

@Injectable()
export class CredentialDao {
  constructor(private readonly dbService: DbService) {}

  findByProviderId(providerId: string): StoredCredential | undefined {
    return this.dbService
      .getDb()
      .select()
      .from(credentials)
      .where(eq(credentials.providerId, providerId))
      .get();
  }

  findProviderIds(): string[] {
    return this.dbService
      .getDb()
      .select({ providerId: credentials.providerId })
      .from(credentials)
      .all()
      .map(({ providerId }) => providerId);
  }

  upsert(providerId: string, encryptedData: Buffer): StoredCredential {
    return this.dbService
      .getDb()
      .insert(credentials)
      .values({ providerId, encryptedData })
      .onConflictDoUpdate({
        target: credentials.providerId,
        set: { encryptedData },
      })
      .returning()
      .get();
  }

  deleteByProviderId(providerId: string): boolean {
    return (
      this.dbService.getDb().delete(credentials).where(eq(credentials.providerId, providerId)).run()
        .changes > 0
    );
  }
}
