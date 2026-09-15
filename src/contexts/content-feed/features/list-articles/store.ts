import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentFeedArticles, contentFeedSources } from "../../database/schema";
import type { ContentFeedArticleRecord } from "../../contracts/types";

export async function findArticles(filters: {
  categoryKeys?: string[];
}): Promise<Array<ContentFeedArticleRecord & { sourceName: string; sourceRemoteUrl: string }>> {
  const rows = await db
    .select({
      article: contentFeedArticles,
      sourceName: contentFeedSources.name,
      sourceRemoteUrl: contentFeedSources.remoteUrl,
    })
    .from(contentFeedArticles)
    .innerJoin(contentFeedSources, eq(contentFeedArticles.sourceId, contentFeedSources.id))
    .where(filters.categoryKeys && filters.categoryKeys.length > 0 ? inArray(contentFeedArticles.categoryKey, filters.categoryKeys) : undefined)
    .orderBy(desc(contentFeedArticles.publishedAt));

  return rows.map((row) => ({ ...row.article, sourceName: row.sourceName, sourceRemoteUrl: row.sourceRemoteUrl }));
}
