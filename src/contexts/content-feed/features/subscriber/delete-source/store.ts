import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentFeedSources } from "../../../database/schema";

export async function findSourceById(id: string): Promise<{ id: string } | null> {
  const [row] = await db.select({ id: contentFeedSources.id }).from(contentFeedSources).where(eq(contentFeedSources.id, id)).limit(1);
  return row ?? null;
}

export async function deleteSourceById(id: string): Promise<void> {
  // source_categories e articles caem junto via onDelete: "cascade" (ver database/schema/index.ts).
  await db.delete(contentFeedSources).where(eq(contentFeedSources.id, id));
}
