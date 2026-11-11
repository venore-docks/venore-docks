import { parseTypeKey } from "@/platform/category-listing/category-href";

// Lógica pura do bloco "Publicações recentes" (sem I/O — testada em entry-feed-data.test.ts).
export const ENTRY_FEED_DEFAULT_CATEGORY = "noticias";
export const ENTRY_FEED_DEFAULT_LIMIT = 3;
export const ENTRY_FEED_MAX_LIMIT = 12;

export type EntryFeedConfig = {
  title: string;
  categorySlug: string;
  // Key de content type (tipo de notícia) para filtrar; null = todos os tipos da categoria.
  typeKey: string | null;
  limit: number;
  viewAllLabel: string;
};

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Lê o `data` do bloco com defaults e limites: slug sem barras nas pontas (aceita "/noticias"),
// limite inteiro entre 1 e 12 (valor inválido/ausente cai no padrão).
export function parseEntryFeedData(data: Record<string, unknown>): EntryFeedConfig {
  const slug = readText(data.categorySlug).replace(/^\/+|\/+$/g, "");
  const rawLimit = typeof data.limit === "string" ? Number(data.limit) : data.limit;
  const limit =
    typeof rawLimit === "number" && Number.isFinite(rawLimit)
      ? Math.min(ENTRY_FEED_MAX_LIMIT, Math.max(1, Math.trunc(rawLimit)))
      : ENTRY_FEED_DEFAULT_LIMIT;
  return {
    title: readText(data.title),
    categorySlug: slug || ENTRY_FEED_DEFAULT_CATEGORY,
    typeKey: parseTypeKey(typeof data.typeKey === "string" ? data.typeKey : null),
    limit,
    viewAllLabel: readText(data.viewAllLabel),
  };
}

// Com exatamente 3 cards o primeiro vira destaque (2 colunas × 2 linhas no desktop) e os outros
// empilham ao lado; nos demais casos a grade é uniforme.
export function isFeaturedLayout(count: number): boolean {
  return count === 3;
}

// Classes da grade, mobile-first: 1 coluna → sm:2 → lg:3 (limitado pela quantidade de cards).
export function entryFeedGridClasses(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2 || count === 4) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
}
