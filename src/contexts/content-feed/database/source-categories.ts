import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentFeedSourceCategories } from "./schema";

// Junction source_categories — categoryKey é texto solto (categoria DO OUTRO lado, sem FK
// possível, ver comentário em database/schema/index.ts).

export async function findCategoryKeysForSource(sourceId: string): Promise<string[]> {
  const rows = await db
    .select({ categoryKey: contentFeedSourceCategories.categoryKey })
    .from(contentFeedSourceCategories)
    .where(eq(contentFeedSourceCategories.sourceId, sourceId));

  return rows.map((row) => row.categoryKey);
}

export async function replaceSourceCategories(sourceId: string, categoryKeys: string[]): Promise<void> {
  await db.delete(contentFeedSourceCategories).where(eq(contentFeedSourceCategories.sourceId, sourceId));
  if (categoryKeys.length > 0) {
    await db.insert(contentFeedSourceCategories).values(categoryKeys.map((categoryKey) => ({ sourceId, categoryKey })));
  }
}
