import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentFeedArticles, contentFeedSources } from "../../../database/schema";
import { findCategoryKeysForSource } from "../../../database/source-categories";
import type { ContentFeedApiArticle, ContentFeedSourceRecord } from "../../../contracts/types";

export async function findSourceById(id: string): Promise<ContentFeedSourceRecord | null> {
  const [row] = await db.select().from(contentFeedSources).where(eq(contentFeedSources.id, id)).limit(1);
  if (!row) return null;
  const categoryKeys = await findCategoryKeysForSource(id);
  return { ...row, categoryKeys };
}

export async function updateSourceSyncState(
  id: string,
  patch: { lastSyncedAt?: Date; lastSyncError: string | null },
): Promise<void> {
  await db.update(contentFeedSources).set(patch).where(eq(contentFeedSources.id, id));
}

// Upsert por (sourceId, remoteRef) — índice único content_feed_articles_source_remote_ref_idx.
// Loop simples (não um bulk insert) porque o volume por sync é pequeno (artigos publicados desde
// a última vez); prioriza clareza sobre performance aqui.
export async function upsertArticles(sourceId: string, articles: ContentFeedApiArticle[]): Promise<void> {
  for (const article of articles) {
    const values = {
      sourceId,
      remoteRef: article.ref,
      title: article.title,
      excerptText: article.excerptText,
      coverImageUrl: article.coverImageUrl,
      categoryKey: article.categoryKey,
      entrySlug: article.entrySlug,
      categorySlug: article.categorySlug,
      publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
      updatedAt: new Date(article.updatedAt),
    };

    await db
      .insert(contentFeedArticles)
      .values(values)
      .onConflictDoUpdate({
        target: [contentFeedArticles.sourceId, contentFeedArticles.remoteRef],
        set: { ...values, fetchedAt: new Date() },
      });
  }
}
