import { extractEntryComposition, getCachedCategoryBySlug, listContentTypes, listEntries } from "@/contexts/cms";
import { getMediaAssetUrls } from "@/contexts/media";
import { extractExcerpt } from "@/platform/seo/entry-excerpt";

export type EntryFeedItem = {
  id: string;
  title: string;
  path: string;
  publishedAt: string | null;
  excerpt: string | null;
  coverUrl: string | null;
};

export type EntryFeed = {
  categoryName: string;
  categoryPath: string;
  items: EntryFeedItem[];
  // Tipo pedido que não existe como content type: o feed vem vazio (não vira "todos os tipos").
  typeNotFound: boolean;
};

// Últimas `limit` entries publicadas da categoria (mais recentes primeiro — listEntries ordena por
// publishedAt quando recebe `limit`). C7: sem sessão só "public", filtrado no banco antes do corte.
// Devolve null quando a categoria não existe.
export async function loadEntryFeed(input: {
  categorySlug: string;
  limit: number;
  viewerIsAuthenticated: boolean;
  typeKey?: string | null;
}): Promise<EntryFeed | null> {
  const categoryResult = await getCachedCategoryBySlug(input.categorySlug);
  if (!categoryResult.success || !categoryResult.data) return null;
  const category = categoryResult.data;

  const categoryPath = `/${category.slug}`;
  let contentTypeId: string | undefined;
  if (input.typeKey) {
    const typesResult = await listContentTypes();
    const match = typesResult.success ? typesResult.data.find((type) => type.key === input.typeKey) : undefined;
    if (!match) return { categoryName: category.name, categoryPath, items: [], typeNotFound: true };
    contentTypeId = match.id;
  }

  const entriesResult = await listEntries({
    categoryId: category.id,
    ...(contentTypeId ? { contentTypeId } : {}),
    ...(input.viewerIsAuthenticated ? {} : { visibility: "public" as const }),
    limit: input.limit,
    offset: 0,
  });
  const records = entriesResult.success ? entriesResult.data : [];

  const coverIds = records.map((entry) => entry.mediaId).filter((id): id is string => Boolean(id));
  const coversResult = await getMediaAssetUrls({ ids: coverIds });
  const coverUrls = coversResult.success ? coversResult.data : {};

  return {
    categoryName: category.name,
    categoryPath,
    typeNotFound: false,
    items: records.map((entry) => ({
      id: entry.id,
      title: entry.title,
      path: `${categoryPath}/${entry.slug}`,
      publishedAt: entry.publishedAt ? entry.publishedAt.toISOString() : null,
      excerpt: extractExcerpt(extractEntryComposition(entry.data), 140),
      coverUrl: entry.mediaId ? (coverUrls[entry.mediaId] ?? null) : null,
    })),
  };
}
