import { extractEntryComposition, listEntries } from "@/contexts/cms";
import type { EntryRecord } from "@/contexts/cms";
import { getMediaAssetUrls } from "@/contexts/media";
import type { ThemeEntryView } from "@/contexts/themes/contracts/v8";
import { extractExcerpt } from "@/platform/seo/entry-excerpt";

// Tamanho do lote da listagem de categoria (blogroll). A página (1º lote) e a rota de
// carregamento automático (`/api/category-entries`, lotes seguintes) usam o MESMO carregador, então
// ordem, visibilidade e formato do card são idênticos nos dois caminhos.
export const CATEGORY_LIST_PAGE_SIZE = 12;

export type CategoryRef = { id: string; name: string; slug: string };

export type CategoryEntriesPage = {
  // Registros crus do lote (a página usa pra montar o JSON-LD só com o que é público).
  records: EntryRecord[];
  entries: ThemeEntryView[];
  hasNextPage: boolean;
};

function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

// Uma consulta de entries (lote + 1, pra saber se há próximo) e uma de mídia pra todas as capas.
// C7: visitante sem sessão só vê "public" — filtrado no banco, ANTES da paginação.
export async function loadCategoryEntries(input: {
  category: CategoryRef;
  page: number;
  viewerIsAuthenticated: boolean;
}): Promise<CategoryEntriesPage> {
  const { category, page, viewerIsAuthenticated } = input;
  const entriesResult = await listEntries({
    categoryId: category.id,
    ...(viewerIsAuthenticated ? {} : { visibility: "public" as const }),
    limit: CATEGORY_LIST_PAGE_SIZE + 1,
    offset: (page - 1) * CATEGORY_LIST_PAGE_SIZE,
  });
  const fetched = entriesResult.success ? entriesResult.data : [];
  const hasNextPage = fetched.length > CATEGORY_LIST_PAGE_SIZE;
  const records = fetched.slice(0, CATEGORY_LIST_PAGE_SIZE);

  const coverIds = records.map((entry) => entry.mediaId).filter((id): id is string => Boolean(id));
  const coversResult = await getMediaAssetUrls({ ids: coverIds });
  const coverUrls = coversResult.success ? coversResult.data : {};

  const categoryPath = `/${category.slug}`;
  const entries: ThemeEntryView[] = records.map((entry) => {
    const coverUrl = entry.mediaId ? (coverUrls[entry.mediaId] ?? null) : null;
    return {
      id: entry.id,
      title: entry.title,
      excerpt: extractExcerpt(extractEntryComposition(entry.data)),
      path: `${categoryPath}/${entry.slug}`,
      publishedAt: toIso(entry.publishedAt),
      updatedAt: toIso(entry.updatedAt),
      category: { label: category.name, href: categoryPath },
      cover: coverUrl ? { url: coverUrl, alt: "" } : null,
    };
  });

  return { records, entries, hasNextPage };
}
