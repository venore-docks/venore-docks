import { listCategories, listEntries, type EntryRecord } from "@/contexts/cms";

export type PublicEntryLink = { entry: EntryRecord; path: string };

// Conteúdo que pode aparecer pra quem não está logado (published + visibility "public"), com o
// caminho público de cada entry — base do sitemap e do RSS. Nunca lista "authenticated".
export async function listPublicEntryLinks(options: { categorySlug?: string; limit?: number } = {}): Promise<{
  entries: PublicEntryLink[];
  categories: { id: string; slug: string; name: string }[];
}> {
  const categoriesResult = await listCategories();
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const slugById = new Map(categories.map((category) => [category.id, category.slug]));
  const category = options.categorySlug ? categories.find((item) => item.slug === options.categorySlug) : undefined;
  if (options.categorySlug && !category) return { entries: [], categories };

  const entriesResult = await listEntries({
    visibility: "public",
    ...(category ? { categoryId: category.id } : {}),
    ...(options.limit ? { limit: options.limit } : {}),
  });
  const entries = (entriesResult.success ? entriesResult.data : [])
    .map((entry) => {
      const categorySlug = entry.categoryId ? slugById.get(entry.categoryId) : null;
      // Entry com categoria que não existe mais não tem endereço público resolvível.
      if (entry.categoryId && !categorySlug) return null;
      return { entry, path: categorySlug ? `/${categorySlug}/${entry.slug}` : `/${entry.slug}` };
    })
    .filter((link): link is PublicEntryLink => link !== null)
    // "home" só existe em "/" (o catch-all devolve 404 em /home).
    .filter((link) => link.path !== "/home");

  return { entries, categories };
}
