import { listCategories, listEntries } from "@/contexts/cms";
import { getMediaAsset } from "@/contexts/media";
import { extractFirstParagraphText } from "../../../shared/excerpt";
import { findConnectionByKey, touchConnectionLastUsed } from "./store";
import type { ListArticlesForConnectionQuery, ListArticlesForConnectionResult } from "./types";
import type { ContentFeedApiArticle } from "../../../contracts/types";

export async function listArticlesForConnection(
  query: ListArticlesForConnectionQuery,
): Promise<ListArticlesForConnectionResult> {
  const connection = await findConnectionByKey(query.key);
  if (!connection) {
    return { success: false, error: { code: "content-feed.connections.invalid_key", message: "Chave de conexão inválida." } };
  }

  if (connection.categoryIds.length === 0) {
    await touchConnectionLastUsed(connection.id);
    return { success: true, data: { articles: [] } };
  }

  const entriesResult = await listEntries({
    categoryIds: connection.categoryIds,
    visibility: "public",
    updatedSince: query.updatedSince,
  });
  if (!entriesResult.success) {
    return { success: false, error: entriesResult.error };
  }

  const categoriesResult = await listCategories();
  const categoriesById = new Map((categoriesResult.success ? categoriesResult.data : []).map((category) => [category.id, category]));

  const articles: ContentFeedApiArticle[] = await Promise.all(
    entriesResult.data.map(async (entry) => {
      const category = entry.categoryId ? categoriesById.get(entry.categoryId) : undefined;
      const coverImageUrl = entry.mediaId ? await resolveCoverImageUrl(entry.mediaId) : null;

      return {
        ref: entry.id,
        title: entry.title,
        excerptText: extractFirstParagraphText(entry.data),
        coverImageUrl,
        categoryKey: category?.key ?? "",
        entrySlug: entry.slug,
        categorySlug: category?.slug ?? null,
        publishedAt: entry.publishedAt ? entry.publishedAt.toISOString() : null,
        updatedAt: entry.updatedAt.toISOString(),
      };
    }),
  );

  await touchConnectionLastUsed(connection.id);
  return { success: true, data: { articles } };
}

async function resolveCoverImageUrl(mediaId: string): Promise<string | null> {
  const result = await getMediaAsset({ id: mediaId });
  if (!result.success || !result.data) return null;
  return result.data.url;
}
