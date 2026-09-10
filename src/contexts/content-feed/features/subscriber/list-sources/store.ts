import { count, desc, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentFeedArticles, contentFeedSourceCategories, contentFeedSources } from "../../../database/schema";
import type { ContentFeedSourceRecord } from "../../../contracts/types";

async function findCategoryKeysForSources(sourceIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (sourceIds.length === 0) return map;

  const rows = await db
    .select({ sourceId: contentFeedSourceCategories.sourceId, categoryKey: contentFeedSourceCategories.categoryKey })
    .from(contentFeedSourceCategories)
    .where(inArray(contentFeedSourceCategories.sourceId, sourceIds));

  for (const row of rows) {
    const list = map.get(row.sourceId);
    if (list) {
      list.push(row.categoryKey);
    } else {
      map.set(row.sourceId, [row.categoryKey]);
    }
  }

  return map;
}

async function findArticleCountsForSources(sourceIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (sourceIds.length === 0) return map;

  const rows = await db
    .select({ sourceId: contentFeedArticles.sourceId, total: count() })
    .from(contentFeedArticles)
    .where(inArray(contentFeedArticles.sourceId, sourceIds))
    .groupBy(contentFeedArticles.sourceId);

  for (const row of rows) {
    map.set(row.sourceId, row.total);
  }

  return map;
}

export async function findAllSources(): Promise<Array<ContentFeedSourceRecord & { articleCount: number }>> {
  const rows = await db.select().from(contentFeedSources).orderBy(desc(contentFeedSources.createdAt));
  const sourceIds = rows.map((row) => row.id);

  const [categoryKeysBySource, articleCountsBySource] = await Promise.all([
    findCategoryKeysForSources(sourceIds),
    findArticleCountsForSources(sourceIds),
  ]);

  return rows.map((row) => ({
    ...row,
    categoryKeys: categoryKeysBySource.get(row.id) ?? [],
    articleCount: articleCountsBySource.get(row.id) ?? 0,
  }));
}
