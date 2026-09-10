import { findArticles } from "./store";
import type { ListArticlesQuery, ListArticlesResult } from "./types";

export async function listArticles(query: ListArticlesQuery): Promise<ListArticlesResult> {
  const rows = await findArticles(query);

  const data = rows.map(({ sourceRemoteUrl, ...article }) => ({
    ...article,
    readMoreUrl: article.categorySlug ? `${sourceRemoteUrl.replace(/\/$/, "")}/${article.categorySlug}/${article.entrySlug}` : null,
  }));

  return { success: true, data };
}
